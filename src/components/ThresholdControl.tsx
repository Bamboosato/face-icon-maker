import { Minus, Plus } from "lucide-react";

interface ThresholdControlProps {
  disabled?: boolean;
  max: number;
  min: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

export function ThresholdControl({
  disabled = false,
  max,
  min,
  step,
  value,
  onChange,
}: ThresholdControlProps) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  function update(nextValue: number) {
    const clampedValue = Math.min(max, Math.max(min, nextValue));
    onChange(Number(clampedValue.toFixed(2)));
  }

  return (
    <div className="threshold-control" aria-label="Detection threshold">
      <span>Detection threshold</span>
      <button
        type="button"
        className="stepper-button"
        disabled={disabled || !canDecrease}
        onClick={() => update(value - step)}
        aria-label="Decrease detection threshold"
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <output aria-live="polite">{value.toFixed(2)}</output>
      <button
        type="button"
        className="stepper-button"
        disabled={disabled || !canIncrease}
        onClick={() => update(value + step)}
        aria-label="Increase detection threshold"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
