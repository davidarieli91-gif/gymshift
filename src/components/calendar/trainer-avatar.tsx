interface TrainerAvatarProps {
  name: string;
  color: string;
  size?: number;
}

/** Circular avatar with initials, tinted with the trainer's personal color */
export function TrainerAvatar({ name, color, size = 30 }: TrainerAvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("");
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials}
    </div>
  );
}
