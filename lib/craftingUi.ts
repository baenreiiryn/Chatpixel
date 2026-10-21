export type CraftUiSlot = {
  slot: number;
  quantity: number;
};

export type CraftUiGuardInput = {
  slots: readonly CraftUiSlot[];
  disabled?: boolean;
  busy?: boolean;
  pendingAttempt?: unknown;
};

export function countOccupiedCraftSlots(slots: readonly CraftUiSlot[]) {
  return new Set(
    slots
      .filter((slot) => slot.quantity > 0)
      .map((slot) => slot.slot),
  ).size;
}

export function isCraftUiLocked({ disabled, busy, pendingAttempt }: Omit<CraftUiGuardInput, "slots">) {
  return Boolean(disabled || busy || pendingAttempt);
}

export function canStartCraftUiAttempt(input: CraftUiGuardInput) {
  return !isCraftUiLocked(input) && countOccupiedCraftSlots(input.slots) >= 2;
}

export async function submitCraftUiAttempt({
  onCraft,
  onStarted,
  ...guard
}: CraftUiGuardInput & {
  onCraft: () => boolean | Promise<boolean>;
  onStarted?: () => void;
}) {
  if (!canStartCraftUiAttempt(guard)) return false;
  const started = await onCraft();
  if (!started) return false;
  onStarted?.();
  return true;
}
