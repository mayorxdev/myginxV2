import React from "react";

interface CopyIconProps {
  onClick: () => void;
  text: string;
}

export default function CopyIcon({ onClick, text }: CopyIconProps) {
  const copyToClipboard = async () => {
    try {
      // Try using the clipboard API first
      await navigator.clipboard.writeText(text);
      onClick();
    } catch (err) {
      // Fallback: Create a temporary textarea element
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        // Execute the copy command
        document.execCommand("copy");
        textArea.remove();
        onClick();
      } catch (err) {
        console.error("Failed to copy text:", err);
      }
      textArea.remove();
    }
  };

  return (
    <button
      onClick={copyToClipboard}
      data-allow-context-menu="true"
      className="ml-2 text-indigo-400 hover:text-indigo-400 transition-colors"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    </button>
  );
}
