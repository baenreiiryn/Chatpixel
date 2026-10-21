"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type TouchEvent,
} from "react";
import type { InventoryItem } from "@/lib/game";
import {
  craftLevelForXp,
  rarityCapForLevel,
  type CraftDiscipline,
  type CraftingState,
  type CraftRecipe,
} from "@/lib/crafting";
import {
  canStartCraftUiAttempt,
  countOccupiedCraftSlots,
  isCraftUiLocked,
} from "@/lib/craftingUi";
import { resolveCraftingItemIcon } from "@/lib/craftingItemIcons";
import styles from "./CraftingWorkshop.module.css";

type CraftInventoryItem = InventoryItem & {
  sourceId?: string;
  rarity?: string;
  art?: string;
};

export type CraftingWorkshopSlot = {
  slot: number;
  sourceId?: string;
  itemId?: string;
  itemName: string;
  quantity: number;
};

export type CraftingWorkshopProps = {
  crafting: CraftingState;
  inventory: InventoryItem[];
  disabled?: boolean;
  busy?: boolean;
  statusText?: string;
  onCraft: (
    discipline: CraftDiscipline,
    selectedSlots: CraftingWorkshopSlot[],
    intent: string,
  ) => void | Promise<void>;
  onCancelAttempt?: () => void;
};

const DISCIPLINES: Array<{
  id: CraftDiscipline;
  label: string;
  shortLabel: string;
  theme: "forge" | "arcane" | "alchemy";
  icon: string;
  description: string;
}> = [
  {
    id: "mundane",
    label: "Mundano",
    shortLabel: "Forja",
    theme: "forge",
    icon: "⚒",
    description: "Armas, armaduras, ferramentas e itens comuns.",
  },
  {
    id: "enchantment",
    label: "Encantamentos",
    shortLabel: "Arcano",
    theme: "arcane",
    icon: "✦",
    description: "Infunda itens mundanos com propriedades arcanas.",
  },
  {
    id: "alchemy",
    label: "Alquimia",
    shortLabel: "Laboratório",
    theme: "alchemy",
    icon: "⚗",
    description: "Poções, venenos, óleos e reagentes alquímicos.",
  },
];

const XP_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];

const RARITY_LABELS: Record<string, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  "very-rare": "Muito raro",
  legendary: "Lendário",
};

const RARITY_RANK: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  "very-rare": 3,
  legendary: 4,
};

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function recipeIngredientMatchesSlot(
  ingredient: CraftRecipe["ingredients"][number],
  slot: CraftingWorkshopSlot,
) {
  if (ingredient.sourceId && slot.sourceId) return ingredient.sourceId === slot.sourceId;
  if (ingredient.itemId && slot.itemId && ingredient.itemId === slot.itemId) return true;
  return normalizeName(ingredient.itemName) === normalizeName(slot.itemName);
}

function recipeIngredientMatchesItem(
  ingredient: CraftRecipe["ingredients"][number],
  item: CraftInventoryItem,
) {
  if (ingredient.sourceId && item.sourceId) return item.sourceId === ingredient.sourceId;
  if (ingredient.itemId && item.id === ingredient.itemId) return true;
  return normalizeName(item.name) === normalizeName(ingredient.itemName);
}

function recipeIsBlocked(recipe: CraftRecipe, level: number) {
  if (recipe.result.rarity === "legendary") return true;
  const cap = rarityCapForLevel(level);
  return (RARITY_RANK[recipe.result.rarity] ?? 99) > (RARITY_RANK[cap] ?? -1);
}

function recipeSatisfied(recipe: CraftRecipe, slots: CraftingWorkshopSlot[]) {
  if (recipe.layout === "shaped") {
    return recipe.ingredients.every((ingredient) => {
      const selected = slots.find((slot) => slot.slot === ingredient.slot);
      if (!selected) return false;
      return (
        recipeIngredientMatchesSlot(ingredient, selected)
        && selected.quantity >= ingredient.quantity
      );
    });
  }
  const remaining = slots.map((slot) => ({ ...slot, quantity: Math.max(0, slot.quantity) }));
  for (const ingredient of recipe.ingredients) {
    let needed = Math.max(0, ingredient.quantity);
    for (const slot of remaining) {
      if (needed <= 0) break;
      if (slot.quantity <= 0 || !recipeIngredientMatchesSlot(ingredient, slot)) continue;
      const used = Math.min(needed, slot.quantity);
      needed -= used;
      slot.quantity -= used;
    }
    if (needed > 0) return false;
  }
  return remaining.every((slot) => slot.quantity === 0);
}

function progressForXp(xp: number) {
  const level = craftLevelForXp(xp);
  if (level >= 10) return { level, percent: 100, next: XP_THRESHOLDS[10] };
  const start = XP_THRESHOLDS[level] ?? 0;
  const next = XP_THRESHOLDS[level + 1] ?? XP_THRESHOLDS[10];
  const percent = Math.max(0, Math.min(100, ((xp - start) / Math.max(1, next - start)) * 100));
  return { level, percent, next };
}

function CraftItemSvg({
  name,
  detail,
  className = "",
}: {
  name?: string;
  detail?: string;
  className?: string;
}) {
  const resolved = resolveCraftingItemIcon(name, detail);
  return (
    <span
      className={`${styles.craftItemSvg} ${className}`.trim()}
      style={{
        WebkitMaskImage: `url("${resolved.path}")`,
        maskImage: `url("${resolved.path}")`,
      }}
      aria-hidden="true"
    />
  );
}

export default function CraftingWorkshop({
  crafting,
  inventory,
  disabled = false,
  busy = false,
  statusText,
  onCraft,
  onCancelAttempt,
}: CraftingWorkshopProps) {
  const [discipline, setDiscipline] = useState<CraftDiscipline>("mundane");
  const [showDetails, setShowDetails] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"recipes" | "inventory">("recipes");
  const [slots, setSlots] = useState<CraftingWorkshopSlot[]>([]);
  const [armedItemId, setArmedItemId] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [recipeNotice, setRecipeNotice] = useState("");
  const [craftIntent, setCraftIntent] = useState("");
  const [touchDrag, setTouchDrag] = useState<{
    itemId: string;
    x: number;
    y: number;
    slotIndex: number | null;
  } | null>(null);
  const touchDragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchDragRef = useRef<{
    itemId: string;
    identifier: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const suppressInventoryClickUntilRef = useRef(0);

  const pendingAttempt = crafting.pendingAttempt;
  const locked = isCraftUiLocked({ disabled, busy, pendingAttempt });
  const canCancelAttempt = Boolean(pendingAttempt?.stage === "review" && !busy && !disabled && onCancelAttempt);
  const inventoryItems = inventory as CraftInventoryItem[];
  const activeMeta = DISCIPLINES.find((item) => item.id === discipline) ?? DISCIPLINES[0];
  const activeProgress = progressForXp(crafting.progress[discipline]?.xp ?? 0);
  const recipes = useMemo(
    () => crafting.recipes.filter((recipe) => recipe.discipline === discipline),
    [crafting.recipes, discipline],
  );
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null;
  const selectedRecipeBlocked = selectedRecipe
    ? recipeIsBlocked(selectedRecipe, activeProgress.level)
    : false;
  const selectedRecipeReady = selectedRecipe ? recipeSatisfied(selectedRecipe, slots) : true;
  const occupiedSlotCount = countOccupiedCraftSlots(slots);
  const hasMinimumGridItems = occupiedSlotCount >= 2;
  const canCraft = canStartCraftUiAttempt({ slots, disabled, busy, pendingAttempt })
    && !selectedRecipeBlocked
    && selectedRecipeReady;

  useEffect(() => {
    if (!pendingAttempt) return;
    setDiscipline(pendingAttempt.discipline);
    setSelectedRecipeId(pendingAttempt.recipeId ?? null);
    setCraftIntent(pendingAttempt.intent ?? "");
    setSlots(
      pendingAttempt.ingredients.map((ingredient) => ({
        slot: ingredient.slot,
        sourceId: ingredient.sourceId,
        itemId: ingredient.itemId,
        itemName: ingredient.itemName,
        quantity: ingredient.quantity,
      })),
    );
    setArmedItemId(null);
  }, [pendingAttempt?.id]);

  useEffect(() => {
    if (pendingAttempt) return;
    setSlots((current) => current.flatMap((slot) => {
      const item = inventoryItems.find((candidate) => (
        (slot.sourceId && candidate.sourceId === slot.sourceId)
        || (slot.itemId && candidate.id === slot.itemId)
        || normalizeName(candidate.name) === normalizeName(slot.itemName)
      ));
      if (!item) return [];
      return [{
        ...slot,
        itemId: item.id,
        sourceId: item.sourceId,
        itemName: item.name,
        quantity: Math.min(slot.quantity, item.qty),
      }];
    }).filter((slot) => slot.quantity > 0));
  }, [inventory, pendingAttempt]);

  useEffect(() => () => {
    if (touchDragTimerRef.current) clearTimeout(touchDragTimerRef.current);
  }, []);

  const reservedByItem = useMemo(() => {
    const totals = new Map<string, number>();
    for (const slot of slots) {
      const item = inventoryItems.find((candidate) => (
        (slot.itemId && candidate.id === slot.itemId)
        || (slot.sourceId && candidate.sourceId === slot.sourceId)
        || normalizeName(candidate.name) === normalizeName(slot.itemName)
      ));
      if (!item) continue;
      totals.set(item.id, (totals.get(item.id) ?? 0) + slot.quantity);
    }
    return totals;
  }, [inventoryItems, slots]);

  function switchDiscipline(next: CraftDiscipline) {
    if (locked || next === discipline) return;
    setDiscipline(next);
    setSlots([]);
    setSelectedRecipeId(null);
    setRecipeNotice("");
    setArmedItemId(null);
  }

  function clearRecipeSelection() {
    setSelectedRecipeId(null);
    setRecipeNotice("");
  }

  function placeItem(slotIndex: number, itemId: string) {
    if (locked) return;
    const item = inventoryItems.find((candidate) => candidate.id === itemId);
    if (!item) return;

    setSlots((current) => {
      const existing = current.find((slot) => slot.slot === slotIndex);
      const reservedElsewhere = current.reduce((total, slot) => {
        if (slot.slot === slotIndex) return total;
        return slot.itemId === item.id ? total + slot.quantity : total;
      }, 0);
      const remaining = Math.max(0, item.qty - reservedElsewhere);
      if (remaining < 1) return current;

      const nextQuantity = existing?.itemId === item.id
        ? Math.min(existing.quantity + 1, remaining)
        : 1;
      const nextSlot: CraftingWorkshopSlot = {
        slot: slotIndex,
        sourceId: item.sourceId,
        itemId: item.id,
        itemName: item.name,
        quantity: nextQuantity,
      };
      return [...current.filter((slot) => slot.slot !== slotIndex), nextSlot]
        .sort((a, b) => a.slot - b.slot);
    });
    clearRecipeSelection();
    setArmedItemId(null);
  }

  function changeQuantity(slotIndex: number, delta: number, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (locked) return;
    setSlots((current) => {
      const slot = current.find((candidate) => candidate.slot === slotIndex);
      if (!slot) return current;
      if (slot.quantity + delta <= 0) {
        return current.filter((candidate) => candidate.slot !== slotIndex);
      }
      const item = inventoryItems.find((candidate) => candidate.id === slot.itemId);
      if (!item) return current;
      const elsewhere = current.reduce(
        (total, candidate) => candidate.slot !== slotIndex && candidate.itemId === item.id
          ? total + candidate.quantity
          : total,
        0,
      );
      const max = Math.max(0, item.qty - elsewhere);
      return current.map((candidate) => candidate.slot === slotIndex
        ? { ...candidate, quantity: Math.min(max, candidate.quantity + delta) }
        : candidate);
    });
    clearRecipeSelection();
  }

  function clearSlot(slotIndex: number, event?: MouseEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    if (locked) return;
    setSlots((current) => current.filter((slot) => slot.slot !== slotIndex));
    clearRecipeSelection();
  }

  function handleDrop(event: DragEvent<HTMLElement>, slotIndex: number) {
    event.preventDefault();
    if (locked) return;
    const itemId = event.dataTransfer.getData("application/x-oracle-craft-item")
      || event.dataTransfer.getData("text/plain");
    if (itemId) placeItem(slotIndex, itemId);
  }

  function clearTouchDrag() {
    if (touchDragTimerRef.current) {
      clearTimeout(touchDragTimerRef.current);
      touchDragTimerRef.current = null;
    }
    touchDragRef.current = null;
    setTouchDrag(null);
  }

  function cancelActiveTouchDrag() {
    if (touchDragRef.current?.active) {
      suppressInventoryClickUntilRef.current = Date.now() + 650;
    }
    clearTouchDrag();
  }

  function touchDragSlotAt(x: number, y: number) {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-craft-slot]");
    if (!element) return null;
    const value = Number(element.dataset.craftSlot);
    return Number.isInteger(value) && value >= 0 && value <= 8 ? value : null;
  }

  function handleInventoryTouchStart(event: TouchEvent<HTMLButtonElement>, itemId: string) {
    if (locked) return;
    if (event.touches.length !== 1) {
      cancelActiveTouchDrag();
      return;
    }
    const touch = event.touches[0];
    clearTouchDrag();
    touchDragRef.current = {
      itemId,
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      active: false,
    };
    touchDragTimerRef.current = setTimeout(() => {
      const current = touchDragRef.current;
      if (!current || current.itemId !== itemId) return;
      current.active = true;
      setTouchDrag({
        itemId,
        x: current.startX,
        y: current.startY,
        slotIndex: touchDragSlotAt(current.startX, current.startY),
      });
    }, 180);
  }

  function handleInventoryTouchMove(event: TouchEvent<HTMLButtonElement>) {
    const current = touchDragRef.current;
    if (!current) return;
    if (event.touches.length !== 1) {
      cancelActiveTouchDrag();
      return;
    }
    const touch = Array.from(event.touches).find((candidate) => candidate.identifier === current.identifier);
    if (!touch) {
      cancelActiveTouchDrag();
      return;
    }
    if (!current.active) {
      const distance = Math.hypot(touch.clientX - current.startX, touch.clientY - current.startY);
      if (distance > 10 && touchDragTimerRef.current) {
        clearTimeout(touchDragTimerRef.current);
        touchDragTimerRef.current = null;
        touchDragRef.current = null;
      }
      return;
    }
    event.preventDefault();
    setTouchDrag({
      itemId: current.itemId,
      x: touch.clientX,
      y: touch.clientY,
      slotIndex: touchDragSlotAt(touch.clientX, touch.clientY),
    });
  }

  function handleInventoryTouchEnd(event: TouchEvent<HTMLButtonElement>) {
    const current = touchDragRef.current;
    if (!current) return;
    if (current.active) {
      event.preventDefault();
      const endTouch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === current.identifier);
      if (!endTouch || event.touches.length > 0) {
        suppressInventoryClickUntilRef.current = Date.now() + 650;
        clearTouchDrag();
        return;
      }
      const slotIndex = endTouch
        ? touchDragSlotAt(endTouch.clientX, endTouch.clientY)
        : touchDrag?.slotIndex ?? null;
      const itemId = current.itemId;
      suppressInventoryClickUntilRef.current = Date.now() + 650;
      clearTouchDrag();
      if (slotIndex !== null) placeItem(slotIndex, itemId);
      return;
    }
    clearTouchDrag();
  }

  function handleInventoryTouchCancel() {
    cancelActiveTouchDrag();
  }

  function fillRecipe(recipe: CraftRecipe) {
    if (locked) return;
    setSelectedRecipeId(recipe.id);
    setArmedItemId(null);

    if (recipeIsBlocked(recipe, activeProgress.level)) {
      setRecipeNotice(
        recipe.result.rarity === "legendary"
          ? "Lendário só pode ser obtido como resultado de um crítico."
          : `Seu limite atual é ${RARITY_LABELS[rarityCapForLevel(activeProgress.level)] ?? rarityCapForLevel(activeProgress.level)}.`,
      );
      setSlots([]);
      return;
    }

    const remaining = new Map(inventoryItems.map((item) => [item.id, item.qty]));
    const next: CraftingWorkshopSlot[] = [];
    const missing: string[] = [];
    const occupied = new Set<number>();

    for (const ingredient of recipe.ingredients) {
      const candidates = inventoryItems.filter((item) => recipeIngredientMatchesItem(ingredient, item));
      const item = candidates.find((candidate) => (remaining.get(candidate.id) ?? 0) >= ingredient.quantity)
        ?? candidates.find((candidate) => (remaining.get(candidate.id) ?? 0) > 0);
      const available = item ? remaining.get(item.id) ?? 0 : 0;
      const quantity = Math.min(ingredient.quantity, available);

      if (!item || quantity <= 0) {
        missing.push(`${ingredient.itemName} ×${ingredient.quantity}`);
        continue;
      }

      let slotIndex = ingredient.slot;
      if (slotIndex < 0 || slotIndex > 8 || occupied.has(slotIndex)) {
        slotIndex = Array.from({ length: 9 }, (_, index) => index)
          .find((index) => !occupied.has(index)) ?? -1;
      }
      if (slotIndex < 0) {
        missing.push(`${ingredient.itemName} ×${ingredient.quantity}`);
        continue;
      }

      occupied.add(slotIndex);
      remaining.set(item.id, available - quantity);
      next.push({
        slot: slotIndex,
        sourceId: item.sourceId,
        itemId: item.id,
        itemName: item.name,
        quantity,
      });
      if (quantity < ingredient.quantity) {
        missing.push(`${ingredient.itemName} ×${ingredient.quantity - quantity}`);
      }
    }

    setSlots(next.sort((a, b) => a.slot - b.slot));
    setRecipeNotice(missing.length ? `Faltam: ${missing.join(", ")}.` : "Ingredientes separados no grid.");
  }

  function handleCraft() {
    if (!canCraft) return;
    void onCraft(
      discipline,
      slots.map((slot) => ({ ...slot })).sort((a, b) => a.slot - b.slot),
      craftIntent.trim().slice(0, 500),
    );
  }

  const busyMessage = statusText
    || (pendingAttempt?.stage === "awaiting-roll"
      ? "Rolagem de craft pendente."
      : pendingAttempt
        ? "O Mestre está avaliando esta combinação."
        : busy
          ? "O Mestre está ocupado."
          : disabled
            ? "Craft temporariamente indisponível."
            : occupiedSlotCount === 1
              ? "Use pelo menos dois slots diferentes para tentar um craft."
            : "");

  return (
    <section className={styles.workshop} data-theme={activeMeta.theme}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>OFICINA DE CRAFTING</span>
          <h1>Oficina</h1>
          <p>{activeMeta.description}</p>
        </div>
        <button
          type="button"
          className={styles.detailsButton}
          aria-expanded={showDetails}
          onClick={() => setShowDetails((value) => !value)}
        >
          {showDetails ? "Ocultar detalhes" : "Detalhes"}
        </button>
      </header>

      <nav className={styles.disciplinePicker} aria-label="Mesa de crafting">
        {DISCIPLINES.map((item) => (
          <button
            type="button"
            key={item.id}
            className={discipline === item.id ? styles.disciplineActive : ""}
            aria-pressed={discipline === item.id}
            disabled={locked}
            onClick={() => switchDiscipline(item.id)}
          >
            <span>{item.icon}</span>
            <b>{item.label}</b>
            <small>{item.shortLabel}</small>
          </button>
        ))}
      </nav>

      {showDetails && (
        <>
          <section className={styles.progressPanel} aria-label="Progressão de crafting">
            {DISCIPLINES.map((item) => {
              const xp = crafting.progress[item.id]?.xp ?? 0;
              const progress = progressForXp(xp);
              return (
                <article key={item.id}>
                  <div className={styles.progressHeading}>
                    <span>{item.icon}</span>
                    <div>
                      <b>{item.label}</b>
                      <small>
                        Nível {progress.level} · {xp} XP
                        {progress.level < 10 ? ` / ${progress.next}` : ""}
                      </small>
                    </div>
                    <strong>{RARITY_LABELS[rarityCapForLevel(progress.level)]}</strong>
                  </div>
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-label={`Progresso de ${item.label}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress.percent)}
                  >
                    <i style={{ width: `${progress.percent}%` }} />
                  </div>
                </article>
              );
            })}
          </section>
          <a
            className={styles.iconAttribution}
            href="/crafting-item-icons/ATTRIBUTION.md"
            target="_blank"
            rel="noreferrer"
          >
            Ícones: Game Icons · CC BY 3.0
          </a>
        </>
      )}

      <section className={styles.craftStage} aria-label={`Mesa ${activeMeta.label}`}>
        <div className={styles.stageGlow} aria-hidden="true" />
        <div className={styles.stageInner}>
          <div className={styles.gridBlock}>
            <div className={styles.gridLabel}>
              <span>{activeMeta.icon}</span>
              <div>
                <b>Composição</b>
                <small>Arraste ou selecione itens do inventário</small>
              </div>
            </div>
            <div className={styles.craftGrid}>
              {Array.from({ length: 9 }, (_, slotIndex) => {
                const selected = slots.find((slot) => slot.slot === slotIndex);
                const item = selected
                  ? inventoryItems.find((candidate) => candidate.id === selected.itemId)
                  : null;
                return (
                  <div
                    role="button"
                    tabIndex={locked ? -1 : 0}
                    key={slotIndex}
                    data-craft-slot={slotIndex}
                    className={`${styles.gridSlot} ${selected ? styles.gridSlotFilled : ""} ${armedItemId ? styles.gridSlotReady : ""} ${touchDrag?.slotIndex === slotIndex ? styles.gridSlotDragTarget : ""}`}
                    aria-disabled={locked}
                    aria-label={selected
                      ? `Slot ${slotIndex + 1}: ${selected.itemName}, quantidade ${selected.quantity}`
                      : `Slot ${slotIndex + 1}, vazio`}
                    onClick={() => armedItemId && placeItem(slotIndex, armedItemId)}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === " ") && armedItemId && !locked) {
                        event.preventDefault();
                        placeItem(slotIndex, armedItemId);
                      }
                    }}
                    onDragOver={(event) => {
                      if (!locked) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                      }
                    }}
                    onDrop={(event) => handleDrop(event, slotIndex)}
                  >
                    {selected ? (
                      <>
                        <CraftItemSvg
                          name={item?.name || selected.itemName}
                          detail={item?.detail}
                          className={styles.gridItemSvg}
                        />
                        {selected.quantity > 1 && <span className={styles.slotQuantity}>{selected.quantity}</span>}
                        {!locked && (
                          <span className={styles.slotControls}>
                            <button
                              type="button"
                              aria-label={`Diminuir quantidade de ${selected.itemName}`}
                              onClick={(event) => changeQuantity(slotIndex, -1, event)}
                            >
                              −
                            </button>
                            <button
                              type="button"
                              aria-label={`Aumentar quantidade de ${selected.itemName}`}
                              onClick={(event) => changeQuantity(slotIndex, 1, event)}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              aria-label={`Remover ${selected.itemName} do slot`}
                              onClick={(event) => clearSlot(slotIndex, event)}
                            >
                              ×
                            </button>
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className={styles.slotNumber}>{slotIndex + 1}</span>
                        <i aria-hidden="true" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.flowArrow} aria-hidden="true">
            <span>→</span>
          </div>

          <div className={styles.resultBlock}>
            <small>RESULTADO</small>
            <div className={`${styles.resultSlot} ${selectedRecipe ? styles.resultKnown : ""}`}>
              {selectedRecipe ? (
                <>
                  <span className={styles.resultIconFrame}>
                    <CraftItemSvg
                      name={selectedRecipe.result.name}
                      detail={selectedRecipe.result.detail}
                      className={styles.resultItemSvg}
                    />
                  </span>
                  <b>{selectedRecipe.result.name}</b>
                  <em data-rarity={selectedRecipe.result.rarity}>
                    {RARITY_LABELS[selectedRecipe.result.rarity] ?? selectedRecipe.result.rarity}
                  </em>
                  <small>×{selectedRecipe.result.quantity}</small>
                </>
              ) : (
                <>
                  <span>?</span>
                  <b>Descoberta</b>
                  <p>Experimente uma combinação ou escolha uma receita conhecida.</p>
                </>
              )}
            </div>
            <label className={styles.intentBox}>
              <span>
                <b>O que você está tentando criar?</b>
                <small>{craftIntent.length}/500</small>
              </span>
              <textarea
                value={craftIntent}
                maxLength={500}
                rows={3}
                disabled={locked}
                placeholder="Ex.: quero transformar estes materiais em uma espada leve que canalize eletricidade."
                onChange={(event) => setCraftIntent(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.craftButton}
              disabled={!canCraft}
              onClick={handleCraft}
            >
              <span>{locked ? "◌" : activeMeta.icon}</span>
              {locked ? "Em andamento" : "Craft"}
            </button>
            {canCancelAttempt && (
              <button type="button" className={styles.cancelAttemptButton} onClick={onCancelAttempt}>
                Cancelar tentativa
              </button>
            )}
            {(busyMessage || recipeNotice) && (
              <p className={styles.stageStatus} role="status">
                {busyMessage || recipeNotice}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className={styles.mobileTabs} role="tablist" aria-label="Conteúdo da oficina">
        <button
          type="button"
          role="tab"
          aria-selected={mobilePanel === "recipes"}
          className={mobilePanel === "recipes" ? styles.mobileTabActive : ""}
          onClick={() => setMobilePanel("recipes")}
        >
          Receitas <span>{recipes.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobilePanel === "inventory"}
          className={mobilePanel === "inventory" ? styles.mobileTabActive : ""}
          onClick={() => setMobilePanel("inventory")}
        >
          Inventário <span>{inventoryItems.length}</span>
        </button>
      </div>

      <section className={styles.lowerPanels}>
        <article
          className={`${styles.panel} ${mobilePanel === "recipes" ? styles.mobileActive : ""}`}
          aria-label="Receitas conhecidas"
        >
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.panelIcon}>▤</span>
              <div>
                <h2>Receitas</h2>
                <p>{recipes.length ? `${recipes.length} conhecidas nesta mesa` : "Nenhuma receita aprendida ainda"}</p>
              </div>
            </div>
            <span>Nv. {activeProgress.level}</span>
          </header>
          <div className={styles.panelScroll}>
            {recipes.length ? recipes.map((recipe) => {
              const blocked = recipeIsBlocked(recipe, activeProgress.level);
              const selected = selectedRecipeId === recipe.id;
              return (
                <button
                  type="button"
                  key={recipe.id}
                  className={`${styles.recipeCard} ${selected ? styles.recipeSelected : ""} ${blocked ? styles.recipeBlocked : ""}`}
                  disabled={locked}
                  onClick={() => fillRecipe(recipe)}
                >
                  <span className={styles.recipeIcon}>
                    <CraftItemSvg name={recipe.result.name} detail={recipe.result.detail} />
                  </span>
                  <span className={styles.recipeBody}>
                    <span className={styles.recipeTopline}>
                      <b>{recipe.name}</b>
                      <em data-rarity={recipe.result.rarity}>
                        {RARITY_LABELS[recipe.result.rarity] ?? recipe.result.rarity}
                      </em>
                    </span>
                    <small>
                      {recipe.layout === "shaped" ? "Forma fixa" : "Sem forma"}
                      {" · "}
                      {recipe.ingredients.reduce((total, ingredient) => total + ingredient.quantity, 0)} ingredientes
                    </small>
                    {blocked && (
                      <strong>
                        {recipe.result.rarity === "legendary"
                          ? "Somente por crítico"
                          : `Requer domínio de ${RARITY_LABELS[recipe.result.rarity]}`}
                      </strong>
                    )}
                  </span>
                  <span className={styles.recipeArrow}>{blocked ? "⌁" : "›"}</span>
                </button>
              );
            }) : (
              <div className={styles.emptyState}>
                <span>◇</span>
                <b>Experimente no grid</b>
                <p>Combinações coerentes podem se tornar novas receitas após avaliação do Mestre.</p>
              </div>
            )}
          </div>
        </article>

        <article
          className={`${styles.panel} ${mobilePanel === "inventory" ? styles.mobileActive : ""}`}
          aria-label="Inventário para crafting"
        >
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.panelIcon}>◇</span>
              <div>
                <h2>Inventário</h2>
                <p>Toque para selecionar ou segure e arraste até o grid</p>
              </div>
            </div>
            <span>{inventoryItems.reduce((total, item) => total + item.qty, 0)} itens</span>
          </header>
          <div className={styles.panelScroll}>
            {inventoryItems.length ? inventoryItems.map((item) => {
              const reserved = reservedByItem.get(item.id) ?? 0;
              const available = Math.max(0, item.qty - reserved);
              const armed = armedItemId === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`${styles.inventoryCard} ${armed ? styles.inventoryArmed : ""}`}
                  draggable={!locked && available > 0}
                  disabled={locked || available <= 0}
                  onClick={() => {
                    if (Date.now() < suppressInventoryClickUntilRef.current) {
                      suppressInventoryClickUntilRef.current = 0;
                      return;
                    }
                    if (locked || available <= 0) return;
                    setArmedItemId(armed ? null : item.id);
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData("application/x-oracle-craft-item", item.id);
                    event.dataTransfer.setData("text/plain", item.id);
                    setArmedItemId(item.id);
                  }}
                  onDragEnd={() => setArmedItemId(null)}
                  onTouchStart={(event) => handleInventoryTouchStart(event, item.id)}
                  onTouchMove={handleInventoryTouchMove}
                  onTouchEnd={handleInventoryTouchEnd}
                  onTouchCancel={handleInventoryTouchCancel}
                >
                  <span className={styles.inventoryIcon}>
                    <CraftItemSvg name={item.name} detail={item.detail} />
                  </span>
                  <span className={styles.inventoryBody}>
                    <b>{item.name}</b>
                    <small>{item.detail || "Item do inventário"}</small>
                  </span>
                  <span className={styles.inventoryQty}>
                    <b>×{available}</b>
                    {reserved > 0 && <small>{reserved} no grid</small>}
                  </span>
                </button>
              );
            }) : (
              <div className={styles.emptyState}>
                <span>□</span>
                <b>Inventário vazio</b>
                <p>Adquira materiais durante a aventura para começar a criar.</p>
              </div>
            )}
          </div>
        </article>
      </section>
      {touchDrag && (() => {
        const item = inventoryItems.find((candidate) => candidate.id === touchDrag.itemId);
        if (!item) return null;
        return (
          <div
            className={styles.touchDragGhost}
            style={{ left: touchDrag.x, top: touchDrag.y }}
            aria-hidden="true"
          >
            <CraftItemSvg name={item.name} detail={item.detail} className={styles.touchDragItemSvg} />
          </div>
        );
      })()}
    </section>
  );
}
