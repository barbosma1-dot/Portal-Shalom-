import { Download } from "lucide-react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

interface InstallButtonProps {
  variant?: "header" | "banner";
  onClick?: () => void;
}

export function InstallButton({ variant = "header", onClick }: InstallButtonProps) {
  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt();

  if (isInstalled) return null;

  const handleAction = async () => {
    if (isInstallable) {
      const success = await promptInstall();
      if (!success && onClick) {
        onClick();
      }
    } else if (onClick) {
      onClick();
    }
  };

  if (variant === "banner") {
    return (
      <button
        onClick={handleAction}
        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
        id="install-button-banner"
      >
        <Download size={20} />
        {isInstallable ? "Instalar Aplicativo" : "Como Instalar o App"}
      </button>
    );
  }

  return (
    <button
      onClick={handleAction}
      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 dark:border-slate-700 text-amber-700 dark:text-amber-400 font-semibold hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors cursor-pointer text-sm"
      id="install-button-header"
    >
      <Download size={16} />
      {isInstallable ? "Instalar App" : "Instalar"}
    </button>
  );
}
