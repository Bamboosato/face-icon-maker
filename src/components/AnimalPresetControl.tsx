import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ANIMAL_PRESETS } from "../config/animalPresets";
import type { AnimalPreset, AnimalPresetId } from "../types/animal";

interface AnimalPresetControlProps {
  disabled?: boolean;
  value: AnimalPresetId;
  onChange: (value: AnimalPresetId) => void;
}

type AnimalChoice =
  | AnimalPreset
  | {
      id: "none";
      label: "None";
      overlayUrl?: undefined;
    };

const ANIMAL_CHOICES: readonly AnimalChoice[] = [
  { id: "none", label: "None" },
  ...ANIMAL_PRESETS,
];

export function AnimalPresetControl({
  disabled = false,
  value,
  onChange,
}: AnimalPresetControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = ANIMAL_CHOICES.find((choice) => choice.id === value) ?? ANIMAL_CHOICES[0];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleChange(nextValue: AnimalPresetId) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div className="control-group">
      <h3>Animal face</h3>
      <div className="animal-preset-control" ref={rootRef}>
        <button
          type="button"
          className="animal-select-trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Animal face"
          onClick={() => setIsOpen((open) => !open)}
        >
          <AnimalChoiceContent choice={selected} />
          <ChevronDown className="animal-select-chevron" size={18} aria-hidden="true" />
        </button>
        {isOpen ? (
          <div className="animal-select-menu" role="listbox" aria-label="Animal face choices">
            {ANIMAL_CHOICES.map((choice) => (
              <button
                type="button"
                role="option"
                key={choice.id}
                className={`animal-select-option ${choice.id === value ? "selected" : ""}`}
                aria-selected={choice.id === value}
                onClick={() => handleChange(choice.id)}
              >
                <AnimalChoiceContent choice={choice} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {disabled ? <small className="control-hint">Preparing face landmarks…</small> : null}
    </div>
  );
}

function AnimalChoiceContent({ choice }: { choice: AnimalChoice }) {
  return (
    <span className="animal-choice-content">
      {choice.overlayUrl ? (
        <img className="animal-choice-icon" src={choice.overlayUrl} alt="" />
      ) : (
        <span className="animal-choice-icon animal-choice-icon-none" aria-hidden="true">
          —
        </span>
      )}
      <span className="animal-choice-label">{choice.label}</span>
    </span>
  );
}
