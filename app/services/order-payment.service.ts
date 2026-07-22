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

import type { Blockchain } from "@circle-fin/smart-contract-platform";
import { SupabaseClient } from "@supabase/supabase-js";
import { createAgreementService } from "@/app/services/agreement.service";
import { createOrderService } from "@/app/services/order.service";
import { REFUND_PROTOCOL_ABI_JSON, REFUND_PROTOCOL_BYTECODE } from "@/lib/constants";
import { convertUSDCToContractAmount, parseAmount } from "@/lib/utils/amount";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";
import { circleContractSdk } from "@/lib/utils/smart-contract-platform-client";
import type { Order } from "@/types/orders";

const AGREEMENT_SELECT = `
  *,
  depositor_wallet:wallets!escrow_agreements_depositor_wallet_id_fkey (
    id,
    profile_id,
    wallet_address,
    circle_wallet_id
  ),
  beneficiary_wallet:wallets!escrow_agreements_beneficiary_wallet_id_fkey (
    id,
    profile_id,
    wallet_address,
    circle_wallet_id
  ),
  transactions:transactions!escrow_agreements_transaction_id_fkey (
    amount,
    currency,
    status
  )
`;

type AgreementWithWallets = {
  id: string;
  circle_contract_id: string;
  terms: {
    amounts?: Array<{ amount?: string; for?: string; location?: string }>;
    orderId?: string;
    items?: unknown[];
  };
  depositor_wallet: {
    id: string;
    profile_id: string;
    wallet_address: string;
    circle_wallet_id: string;
  };
  beneficiary_wallet: {
    id: string;
    profile_id: string;
    wallet_address: string;
    circle_wallet_id: string;
  };
  transactions: {
    amount: number;
    currency: string;
    status: string;
  };
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

async function getAgreementWithWallets(
  supabase: SupabaseClient,
  agreementId: string
): Promise<AgreementWithWallets> {
  const { data, error } = await supabase
    .from("escrow_agreements")
    .select(AGREEMENT_SELECT)
    .eq("id", agreementId)
    .single();

  if (error || !data) {
    throw new Error(`Escrow agreement not found: ${error?.message ?? agreementId}`);
  }

  return data as AgreementWithWallets;
}

export const createOrderPaymentService = (supabase: SupabaseClient) => {
  const agreementService = createAgreementService(supabase);
  const orderService = createOrderService(supabase);

  return {
    async initiateOrderPayment(
      orderId: string,
      customerProfileId: string
    ): Promise<{
      order: Order;
      escrowAgreementId: string;
      deployTransactionId: string;
      contractId: string;
    }> {
      const order = await orderService.getOrderById(orderId);

      if (!order) {
        throw new Error("Order not found");
      }

      if (order.customer_profile_id !== customerProfileId) {
        throw new Error("Only the customer can pay for this order");
      }

      if (order.status !== "PENDING_PAYMENT") {
        throw new Error(
          `Order cannot be paid from status ${order.status}. Expected PENDING_PAYMENT.`
        );
      }

      // Circle contract name/description reject hyphens (UUID chars).
      const contractLabel = `Order Escrow ${order.id.replace(/-/g, "")}`;

      let agreementId = order.escrow_agreement_id;
      let transactionId: string | null = null;

      if (agreementId) {
        const { data: existingAgreement, error: existingError } = await supabase
          .from("escrow_agreements")
          .select("id, circle_contract_id, transaction_id, status")
          .eq("id", agreementId)
          .single();

        if (existingError || !existingAgreement) {
          throw new Error("Linked escrow agreement not found");
        }

        if (existingAgreement.circle_contract_id) {
          throw new Error(
            "Order already has an escrow agreement linked. Payment may be in progress."
          );
        }

        // Resume deploy after a previous failed attempt.
        transactionId = existingAgreement.transaction_id;
      } else {
        const { data: customerWallet, error: customerWalletError } =
          await supabase
            .from("wallets")
            .select("id, profile_id, wallet_address, circle_wallet_id")
            .eq("profile_id", order.customer_profile_id)
            .single();

        if (customerWalletError || !customerWallet) {
          throw new Error("Customer wallet not found");
        }

        const { data: storeWallet, error: storeWalletError } = await supabase
          .from("wallets")
          .select("id, profile_id, wallet_address, circle_wallet_id")
          .eq("profile_id", order.store_profile_id)
          .single();

        if (storeWalletError || !storeWallet) {
          throw new Error("Store wallet not found");
        }

        const amountStr = String(order.amount);
        const terms = {
          orderId: order.id,
          items: order.items,
          amounts: [
            {
              amount: amountStr,
              for: "Order payment",
              location: order.delivery_address,
            },
          ],
        };

        const transaction = await agreementService.createTransaction({
          walletId: customerWallet.id,
          profileId: customerWallet.profile_id,
          amount: order.amount,
          description: `Order payment for order ${order.id}`,
          transactionType: "DEPLOY_CONTRACT",
        });

        const agreement = await agreementService.createAgreement({
          beneficiaryWalletId: storeWallet.id,
          depositorWalletId: customerWallet.id,
          transactionId: transaction.id,
          terms,
        });

        await orderService.updateOrder(orderId, {
          escrow_agreement_id: agreement.id,
        });

        await supabase
          .from("transactions")
          .update({ escrow_agreement_id: agreement.id })
          .eq("id", transaction.id);

        agreementId = agreement.id;
        transactionId = transaction.id;
      }

      if (!agreementId || !transactionId) {
        throw new Error("Missing escrow agreement or transaction for payment");
      }

      const agentWalletId = requireEnv("NEXT_PUBLIC_AGENT_WALLET_ID");
      const agentWalletAddress = requireEnv("NEXT_PUBLIC_AGENT_WALLET_ADDRESS");
      const blockchain = requireEnv("CIRCLE_BLOCKCHAIN") as Blockchain;
      const usdcAddress = requireEnv("NEXT_PUBLIC_USDC_CONTRACT_ADDRESS");

      let createResponse;
      try {
        createResponse = await circleContractSdk.deployContract({
          name: contractLabel,
          description: contractLabel,
          walletId: agentWalletId,
          blockchain,
          fee: {
            type: "level",
            config: {
              feeLevel: "MEDIUM",
            },
          },
          constructorParameters: [
            agentWalletAddress,
            usdcAddress,
            "EscrowProtocol",
            "1.0",
          ],
          abiJson: REFUND_PROTOCOL_ABI_JSON,
          bytecode: REFUND_PROTOCOL_BYTECODE,
        });
      } catch (error: any) {
        const circleErrors = error?.response?.data?.errors;
        const circleMessage =
          Array.isArray(circleErrors) && circleErrors.length > 0
            ? circleErrors.map((e: { message?: string }) => e.message).join("; ")
            : error?.response?.data?.message || error?.message;
        throw new Error(`Circle deploy failed: ${circleMessage}`);
      }

      if (!createResponse.data) {
        throw new Error("No data returned from contract deployment");
      }

      const { error: agreementUpdateError } = await supabase
        .from("escrow_agreements")
        .update({
          circle_contract_id: createResponse.data.contractId,
          status: "PENDING",
        })
        .eq("id", agreementId);

      if (agreementUpdateError) {
        throw new Error("Failed to update escrow agreement with contract ID");
      }

      const { error: transactionUpdateError } = await supabase
        .from("transactions")
        .update({ circle_transaction_id: createResponse.data.transactionId })
        .eq("id", transactionId);

      if (transactionUpdateError) {
        throw new Error("Failed to update transaction with Circle transaction ID");
      }

      const updatedOrder = await orderService.getOrderById(orderId);

      return {
        order: updatedOrder as Order,
        escrowAgreementId: agreementId,
        deployTransactionId: createResponse.data.transactionId,
        contractId: createResponse.data.contractId,
      };
    },

    async approveDeposit(agreementId: string): Promise<string | undefined> {
      const agreement = await getAgreementWithWallets(supabase, agreementId);

      if (!agreement.circle_contract_id) {
        throw new Error("Escrow agreement has no Circle contract ID");
      }

      const contractData = await circleContractSdk.getContract({
        id: agreement.circle_contract_id,
      });

      if (!contractData.data?.contract.contractAddress) {
        throw new Error("Could not retrieve contract address");
      }

      const contractAddress = contractData.data.contract.contractAddress;
      const amountStr = agreement.terms.amounts?.[0]?.amount;

      if (!amountStr) {
        throw new Error("Escrow agreement terms missing payment amount");
      }

      const parsedAmount = parseAmount(amountStr);
      const contractAmount = Number(convertUSDCToContractAmount(parsedAmount));
      const usdcAddress = requireEnv("NEXT_PUBLIC_USDC_CONTRACT_ADDRESS");

      const circleApprovalResponse =
        await circleDeveloperSdk.createContractExecutionTransaction({
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [contractAddress, contractAmount],
          contractAddress: usdcAddress,
          fee: {
            type: "level",
            config: {
              feeLevel: "MEDIUM",
            },
          },
          walletId: agreement.depositor_wallet.circle_wallet_id,
        });

      await agreementService.createTransaction({
        walletId: agreement.depositor_wallet.id,
        circleTransactionId: circleApprovalResponse.data?.id,
        escrowAgreementId: agreement.id,
        transactionType: "DEPOSIT_APPROVAL",
        profileId: agreement.depositor_wallet.profile_id,
        amount: parsedAmount,
        description: "Order payment USDC approval",
      });

      await supabase
        .from("escrow_agreements")
        .update({ status: "PENDING" })
        .eq("id", agreement.id);

      return circleApprovalResponse.data?.id;
    },

    async depositPayment(agreementId: string): Promise<string | undefined> {
      const agreement = await getAgreementWithWallets(supabase, agreementId);

      if (!agreement.circle_contract_id) {
        throw new Error("Escrow agreement has no Circle contract ID");
      }

      const contractData = await circleContractSdk.getContract({
        id: agreement.circle_contract_id,
      });

      if (!contractData.data?.contract.contractAddress) {
        throw new Error("Could not retrieve contract address");
      }

      const contractAddress = contractData.data.contract.contractAddress;
      const amountStr = agreement.terms.amounts?.[0]?.amount;

      if (!amountStr) {
        throw new Error("Escrow agreement terms missing payment amount");
      }

      const parsedAmount = parseAmount(amountStr);
      const contractAmount = Number(convertUSDCToContractAmount(parsedAmount));

      const circleDepositResponse =
        await circleDeveloperSdk.createContractExecutionTransaction({
          walletId: agreement.depositor_wallet.circle_wallet_id,
          contractAddress,
          abiFunctionSignature: "pay(address,uint256,address)",
          abiParameters: [
            agreement.beneficiary_wallet.wallet_address,
            contractAmount,
            agreement.depositor_wallet.wallet_address,
          ],
          fee: {
            type: "level",
            config: {
              feeLevel: "MEDIUM",
            },
          },
        });

      await agreementService.createTransaction({
        walletId: agreement.depositor_wallet.id,
        circleTransactionId: circleDepositResponse.data?.id,
        escrowAgreementId: agreement.id,
        transactionType: "DEPOSIT_PAYMENT",
        profileId: agreement.depositor_wallet.profile_id,
        amount: parsedAmount,
        description:
          agreement.terms.amounts?.[0]?.for || "Order payment deposited",
      });

      await supabase
        .from("escrow_agreements")
        .update({ status: "PENDING" })
        .eq("id", agreement.id);

      return circleDepositResponse.data?.id;
    },

    async markOrderPaidByEscrowAgreement(agreementId: string): Promise<void> {
      const { data: order, error } = await supabase
        .from("orders")
        .select("id, status")
        .eq("escrow_agreement_id", agreementId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to find order for escrow: ${error.message}`);
      }

      if (!order || order.status === "PAID") {
        return;
      }

      await orderService.updateOrderStatus(order.id, "PAID");
    },

    async releasePayment(agreementId: string): Promise<string | undefined> {
      const agreement = await getAgreementWithWallets(supabase, agreementId);

      if (!agreement.circle_contract_id) {
        throw new Error("Escrow agreement has no Circle contract ID");
      }

      const contractData = await circleContractSdk.getContract({
        id: agreement.circle_contract_id,
      });

      if (!contractData.data?.contract.contractAddress) {
        throw new Error("Could not retrieve contract address");
      }

      const contractAddress = contractData.data.contract.contractAddress;
      const amountStr = agreement.terms.amounts?.[0]?.amount;

      if (!amountStr) {
        throw new Error("Escrow agreement terms missing payment amount");
      }

      const parsedAmount = parseAmount(amountStr);

      const circleReleaseResponse =
        await circleDeveloperSdk.createContractExecutionTransaction({
          walletId: agreement.beneficiary_wallet.circle_wallet_id,
          contractAddress,
          abiFunctionSignature: "withdraw(uint256[])",
          abiParameters: [[0]],
          fee: {
            type: "level",
            config: {
              feeLevel: "MEDIUM",
            },
          },
        });

      await agreementService.createTransaction({
        walletId: agreement.beneficiary_wallet.id,
        circleTransactionId: circleReleaseResponse.data?.id,
        escrowAgreementId: agreement.id,
        transactionType: "RELEASE_PAYMENT",
        profileId: agreement.beneficiary_wallet.profile_id,
        amount: parsedAmount,
        description: "Funds released after delivery proof validation",
      });

      await supabase
        .from("escrow_agreements")
        .update({ status: "PENDING" })
        .eq("id", agreement.id);

      return circleReleaseResponse.data?.id;
    },

    async markOrderCompletedByEscrowAgreement(
      agreementId: string
    ): Promise<void> {
      const { data: order, error } = await supabase
        .from("orders")
        .select("id, status")
        .eq("escrow_agreement_id", agreementId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to find order for escrow: ${error.message}`);
      }

      if (!order || order.status === "COMPLETED") {
        return;
      }

      await orderService.updateOrderStatus(order.id, "COMPLETED");
    },

    async getLinkedOrderId(agreementId: string): Promise<string | null> {
      const { data, error } = await supabase
        .from("orders")
        .select("id")
        .eq("escrow_agreement_id", agreementId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to find linked order: ${error.message}`);
      }

      return data?.id ?? null;
    },
  };
};
