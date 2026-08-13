/**
 * Toast Notification Component — Sleek Monochrome Vector Toast
 */

import { icons } from "../icons.js";

export function showToast(message, type = "info", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const iconSvg = type === "success" 
    ? icons.success 
    : type === "error" 
    ? icons.error 
    : icons.info;

  toast.innerHTML = `
    <span class="toast-icon-wrap type-${type}">${iconSvg}</span>
    <div class="toast-content">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "all 0.15s ease-out";
    setTimeout(() => {
      toast.remove();
    }, 150);
  }, duration);
}
