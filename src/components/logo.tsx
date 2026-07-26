import { Link } from "@tanstack/react-router";
import logo from "@/assets/reezap-logo.jpg.asset.json";

export function Logo({ size = 32, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img
        src={logo.url}
        alt="Reezap"
        width={size}
        height={size}
        className="rounded-[26%]"
        style={{ width: size, height: size }}
      />
      {withWordmark && (
        <span className="text-[0.95rem] font-extrabold tracking-[0.28em] text-foreground">
          REEZAP
        </span>
      )}
    </Link>
  );
}
