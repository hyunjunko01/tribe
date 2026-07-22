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

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/utils/supabase/client";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StoreProfile {
  id: string;
  name: string;
  email: string;
  wallets: Array<{ id: string; wallet_address: string; profile_id: string }>;
}

interface CreateOrderCardProps {
  onCreated?: () => void;
}

export function CreateOrderCard({ onCreated }: CreateOrderCardProps) {
  const [loadingStores, setLoadingStores] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreProfile | null>(null);
  const [amount, setAmount] = useState("1");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStores = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("Not authenticated");

        const { data: storeProfiles, error: storesError } = await supabase
          .from("profiles")
          .select(
            `
            id,
            name,
            email,
            wallets (
              id,
              wallet_address,
              profile_id
            )
          `
          )
          .neq("auth_user_id", user.id);

        if (storesError) throw storesError;

        const validStores = (storeProfiles ?? []).filter(
          (profile) => profile.wallets && profile.wallets.length > 0
        ) as StoreProfile[];

        setStores(validStores);
      } catch (err) {
        console.error("Error loading stores:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load store profiles"
        );
      } finally {
        setLoadingStores(false);
      }
    };

    loadStores();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedStore) {
      toast.error("Please select a store");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Amount must be a positive number");
      return;
    }

    if (!deliveryAddress.trim()) {
      toast.error("Delivery address is required");
      return;
    }

    const quantity = Number(itemQuantity);
    const items =
      itemName.trim() && Number.isFinite(quantity) && quantity > 0
        ? [{ name: itemName.trim(), quantity }]
        : [];

    setSubmitting(true);

    try {
      const createRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeProfileId: selectedStore.id,
          amount: parsedAmount,
          deliveryAddress: deliveryAddress.trim(),
          items,
        }),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(
          createData.error || createData.details || "Failed to create order"
        );
      }

      const orderId = createData.order?.id as string | undefined;
      if (!orderId) {
        throw new Error("Order created but no id returned");
      }

      const payRes = await fetch(`/api/orders/${orderId}/pay`, {
        method: "POST",
      });
      const payData = await payRes.json();

      if (!payRes.ok) {
        throw new Error(
          payData.details ||
            payData.error ||
            "Order created, but payment failed to start"
        );
      }

      toast.success("Order created. Payment is processing…");
      setDeliveryAddress("");
      setItemName("");
      setItemQuantity("1");
      setAmount("1");
      setSelectedStore(null);
      onCreated?.();
    } catch (err) {
      console.error("Create order failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <Card className="grow">
        <CardHeader>
          <CardTitle>Create order</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="grow">
      <CardHeader>
        {loadingStores ? (
          <Skeleton className="h-6 w-40 rounded-full" />
        ) : (
          <CardTitle>Create order</CardTitle>
        )}
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label>Store</Label>
            {loadingStores ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {selectedStore
                      ? selectedStore.name || selectedStore.email
                      : "Select store..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search store..." />
                    <CommandList>
                      {stores.length > 0 ? (
                        <CommandGroup>
                          {stores.map((store) => (
                            <CommandItem
                              key={store.id}
                              value={`${store.name} ${store.email}`}
                              onSelect={() => {
                                setSelectedStore(store);
                                setOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedStore?.id === store.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {store.name && store.email
                                ? `${store.name} (${store.email})`
                                : store.name || store.email}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ) : (
                        <CommandEmpty>No stores found.</CommandEmpty>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="order-amount">Amount (USDC)</Label>
            <Input
              id="order-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loadingStores || submitting}
              required
            />
          </div>

          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="order-address">Delivery address</Label>
            <Input
              id="order-address"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="123 Main St"
              disabled={loadingStores || submitting}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 flex flex-col space-y-1.5">
              <Label htmlFor="order-item">Item (optional)</Label>
              <Input
                id="order-item"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Burger"
                disabled={loadingStores || submitting}
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="order-qty">Qty</Label>
              <Input
                id="order-qty"
                type="number"
                min="1"
                step="1"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                disabled={loadingStores || submitting}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={loadingStores || submitting || !selectedStore}
          >
            {submitting ? "Creating & paying…" : "Create & pay"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
