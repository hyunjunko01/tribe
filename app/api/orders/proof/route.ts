/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createOrderService } from "@/app/services/order.service";
import { createOrderPaymentService } from "@/app/services/order-payment.service";
import { openai } from "@/lib/utils/openAIClient";
import { handleOpenAIError } from "@/lib/utils/openai-error-handler";
import { FILE_CONSTANTS } from "@/lib/constants";
import type { OrderItem } from "@/types/orders";

const MAX_PROOF_BYTES = FILE_CONSTANTS.MAX_SIZE_5MB;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

interface ImageValidationResult {
  valid: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
}

function formatItems(items: OrderItem[]): string {
  if (!items?.length) return "- (no item list provided)";
  return items
    .map((item) => {
      const qty = item.quantity ?? 1;
      return `- ${qty}x ${item.name}${item.notes ? ` (${item.notes})` : ""}`;
    })
    .join("\n");
}

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  return "jpg";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const orderService = createOrderService(supabase);
    const paymentService = createOrderPaymentService(supabase);

    const { searchParams } = new URL(req.url);
    const formData = await req.formData();

    const tokenFromQuery = searchParams.get("token");
    const tokenFromForm = formData.get("token");
    const token =
      tokenFromQuery ||
      (typeof tokenFromForm === "string" ? tokenFromForm : null);

    if (!token) {
      return NextResponse.json(
        { error: "Missing delivery token" },
        { status: 400 }
      );
    }

    const imageFile = formData.get("file");
    if (!imageFile || !(imageFile instanceof Blob)) {
      return NextResponse.json(
        { error: "Image file is missing or invalid" },
        { status: 400 }
      );
    }

    if (imageFile.size > MAX_PROOF_BYTES) {
      return NextResponse.json(
        { error: "Image must be smaller than 5 MB" },
        { status: 400 }
      );
    }

    const contentType = imageFile.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Only JPEG and PNG images are allowed" },
        { status: 400 }
      );
    }

    const order = await orderService.getOrderByDeliveryToken(token);

    if (!order) {
      return NextResponse.json(
        { error: "Invalid or expired delivery token" },
        { status: 404 }
      );
    }

    if (order.status !== "IN_DELIVERY") {
      return NextResponse.json(
        {
          error: `Order cannot accept proof from status ${order.status}. Expected IN_DELIVERY.`,
        },
        { status: 409 }
      );
    }

    if (order.delivery_proof_url) {
      return NextResponse.json(
        { error: "Delivery proof already submitted for this order" },
        { status: 409 }
      );
    }

    if (!order.escrow_agreement_id) {
      return NextResponse.json(
        { error: "Order has no linked escrow agreement" },
        { status: 422 }
      );
    }

    const timestamp = Date.now();
    const ext = extensionForMime(contentType);
    const filePath = `orders/${order.id}/proof-${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(FILE_CONSTANTS.BUCKET_NAME)
      .upload(filePath, imageFile, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload delivery proof:", uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(FILE_CONSTANTS.BUCKET_NAME)
      .createSignedUrl(filePath, 7 * 24 * 60 * 60);

    const proofUrl = signedUrlData?.signedUrl ?? filePath;

    if (signedUrlError) {
      console.warn("Could not create signed URL for proof:", signedUrlError);
    }

    await orderService.updateOrder(order.id, {
      delivery_proof_url: proofUrl,
      delivery_token: null,
    });

    const itemsText = formatItems(order.items ?? []);
    const prompt = `
      Validate if the attached image is credible delivery proof for a food/package delivery order.
      Provide your answer in JSON format following this example:

      {
        "valid": true,
        "confidence": "MEDIUM",
        "reasons": [
          "First reason why the image does not match the criteria",
          "Second reason why the image does not match the criteria"
        ]
      }

      Your answer should not contain anything else other than that, including markdown formatting.
      Things like triple backticks should be completely stripped out.

      Where "valid" is a boolean and "confidence" is a string that can be either:

      - "LOW": You don't think the given image matches the requirements.
      - "MEDIUM": You are unsure or the image loosely matches some requirements but not all.
      - "HIGH": You are absolutely certain that the provided image strictly fulfills all the requirements.

      The "reasons" property must be an array of strings that contains a list of reasons why the
      image is not valid or does not have "HIGH" confidence. This array can be left empty if the
      attached image meets all the criteria.

      Delivery context:
      - Delivery address: ${order.delivery_address}
      - Order items:
      ${itemsText}

      The photo should show evidence that goods were delivered (e.g. package/food at a doorstep,
      handed to a recipient, or clearly left at the delivery location). Ignore requirements that
      are not visually verifiable from a photo.
    `;

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64Image}`;

    let validation: ImageValidationResult;
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0,
      });

      const [promptAnswer] = response.choices;
      const promptAnswerContent = promptAnswer.message.content;

      if (!promptAnswerContent) {
        return NextResponse.json(
          { error: "Failed to retrieve the delivery validation result" },
          { status: 500 }
        );
      }

      validation = JSON.parse(promptAnswerContent);
    } catch (openaiError) {
      const { status, body } = handleOpenAIError(openaiError);
      return NextResponse.json(body, { status });
    }

    const workMeetsRequirements =
      validation.valid && validation.confidence === "HIGH";

    if (!workMeetsRequirements) {
      const disputed = await orderService.updateOrderStatus(
        order.id,
        "DISPUTED"
      );

      return NextResponse.json(
        {
          error: "Delivery proof did not pass AI validation",
          reasons: validation.reasons,
          confidence: validation.confidence,
          order: disputed,
        },
        { status: 400 }
      );
    }

    const releaseTransactionId = await paymentService.releasePayment(
      order.escrow_agreement_id
    );

    const updatedOrder = await orderService.getOrderById(order.id);

    return NextResponse.json(
      {
        success: true,
        message: "Delivery proof accepted. Funds release initiated.",
        order: updatedOrder,
        releaseTransactionId,
        validation,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error processing delivery proof:", error);
    return NextResponse.json(
      {
        error: "Failed to process delivery proof",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
