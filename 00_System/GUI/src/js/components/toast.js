/**
 * Toast Notification Component
 */

export function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const icon = type === "success" 
    ? "✅" 
    : type === "error" 
    ? "❌" 
    : "ℹ️";

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-content">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.2s ease-out";
    setTimeout(() => {
      toast.remove();
    }, 200);
  }, duration);
}
