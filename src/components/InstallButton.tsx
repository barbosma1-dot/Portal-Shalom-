import { Download } from "lucide-react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

interface InstallButtonProps {
  variant?: "header" | "banner";
}

export function InstallButton({ variant = "header" }: InstallButtonProps) {
  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt();

  if (isInstalled || !isInstallable) return null;

  if (variant === "banner") {
    return (
      <button
        onClick={promptInstall}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        <Download size={20} />
        Instalar Aplicativo
      </button>
    );
  }

  return (
    <button
      onClick={promptInstall}
      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-300 text-orange-700 font-semibold hover:bg-orange-50 transition-colors"
    >
      <Download size={16} />
      Instalar App
    </button>
  );
}
