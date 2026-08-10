import { Link, useRouterState } from "@tanstack/react-router";
import { Languages, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useI18n, nextLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function PublicShell({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "light";
}) {
  const { t, lang, setLang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const light = variant === "light";

  return (
    <div className={cn("min-h-screen", light ? "bg-white text-black" : "bg-background")}>
      <header
        className={cn(
          "sticky top-0 z-30 border-b backdrop-blur",
          light ? "border-black/10 bg-white/85" : "bg-background/85",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Sparkles className={cn("h-5 w-5", light ? "text-black" : "text-accent")} />
            {t("app.title")}
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" active={pathname === "/"} light={light}>
              {t("nav.home")}
            </NavLink>
            <NavLink
              to="/collections"
              active={pathname.startsWith("/collections")}
              light={light}
            >
              {t("nav.catalog")}
            </NavLink>
            <NavLink to="/admin" active={pathname.startsWith("/admin")} light={light}>
              {t("nav.admin")}
            </NavLink>
            <Button variant="ghost" size="sm" onClick={() => setLang(nextLang(lang))}>
              <Languages className="mr-1.5 h-4 w-4" />
              {t("lang.switch")}
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}

function NavLink({
  to,
  active,
  light,
  children,
}: {
  to: string;
  active: boolean;
  light: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm",
        active
          ? "font-medium"
          : light
            ? "text-black/60 hover:text-black"
            : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
