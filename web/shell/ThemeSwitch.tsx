import type { ThemePref } from "../lib/theme";
import { Segmented } from "../ui/Card";

/** Los tres temas permanecen visibles en la barra lateral y el menú móvil. */
export function ThemeSwitch({
  value,
  onChange,
}: {
  value: ThemePref;
  onChange: (value: ThemePref) => void;
}) {
  return (
    <Segmented<ThemePref>
      tone="dark"
      size="sm"
      equalWidth
      label="Tema de la interfaz"
      className="mt-2 [&>button]:min-h-14 [&>button]:flex-col [&>button]:gap-1 [&>button]:px-1 [&>button]:py-2"
      value={value}
      onChange={onChange}
      options={[
        { value: "light", label: "Claro", icon: "sun" },
        { value: "dark", label: "Oscuro", icon: "moon" },
        { value: "system", label: "Auto", icon: "themeAuto" },
      ]}
    />
  );
}
