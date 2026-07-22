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

"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SubmitState = "idle" | "submitting" | "success" | "rejected";

export default function DeliverClient() {
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get("token")?.trim() || "",
    [searchParams]
  );

  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token) {
      toast.error("Missing delivery token");
      return;
    }

    if (!file) {
      toast.error("Please choose a delivery photo");
      return;
    }

    setState("submitting");
    setMessage(null);
    setReasons([]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);

      const res = await fetch(
        `/api/orders/proof?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();

      if (!res.ok) {
        const rejectionReasons: string[] = Array.isArray(data.reasons)
          ? data.reasons
          : [];
        setReasons(rejectionReasons);
        setMessage(
          data.error || data.details || "Delivery proof was not accepted"
        );
        setState("rejected");
        toast.error("Proof rejected");
        return;
      }

      setMessage(
        data.message ||
          "Proof accepted. Funds release is processing — order will complete shortly."
      );
      setState("success");
      toast.success("Proof submitted");
      setFile(null);
    } catch (err) {
      console.error("Proof upload failed:", err);
      setMessage(err instanceof Error ? err.message : "Upload failed");
      setState("rejected");
      toast.error("Upload failed");
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Upload delivery proof</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {!token ? (
              <p className="text-sm text-red-500">
                This link is missing a delivery token. Ask the store for a new
                link.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Take a clear photo of the delivered order, then submit. No
                  login required.
                </p>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="proof-file">Photo (JPEG or PNG)</Label>
                  <Input
                    id="proof-file"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    disabled={state === "submitting" || state === "success"}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                {message && (
                  <div
                    className={
                      state === "success"
                        ? "rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800"
                        : "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                    }
                  >
                    <p>{message}</p>
                    {reasons.length > 0 && (
                      <ul className="mt-2 list-disc pl-5">
                        {reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={
                !token ||
                !file ||
                state === "submitting" ||
                state === "success"
              }
            >
              {state === "submitting" ? "Uploading…" : "Submit proof"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
