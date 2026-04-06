/**
 * Единая модалка заявки (главная + карточка товара): POST /api/leads.
 */
(function () {
  var leadProductLabel = "Запрос прайса";

  function injectToastStyles() {
    if (document.getElementById("lead-toast-styles")) return;
    var s = document.createElement("style");
    s.id = "lead-toast-styles";
    s.textContent =
      "#leadModalErr{color:#f87171;font-size:14px;margin:0 0 10px;line-height:1.4}" +
      ".lead-toast{position:fixed;bottom:24px;left:50%;transform:translate(-50%,100px);z-index:1000;" +
      "background:#141414;border:1px solid rgba(255,193,7,.35);color:#fff;padding:14px 22px;border-radius:14px;" +
      "font-size:15px;font-weight:600;box-shadow:0 12px 40px rgba(0,0,0,.55);opacity:0;" +
      "transition:transform .35s ease,opacity .35s ease;max-width:min(90vw,360px);text-align:center;font-family:inherit}" +
      ".lead-toast--show{transform:translate(-50%,0);opacity:1}";
    document.head.appendChild(s);
  }

  function bumpLocalLeadStats() {
    try {
      var STORAGE_KEY = "zwillon_stats";
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : { visits: 0, leads: 0 };
      if (!data || typeof data !== "object") data = { visits: 0, leads: 0 };
      data.leads = (Number(data.leads) || 0) + 1;
      data.visits = Number(data.visits) || 0;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      var l = document.getElementById("leads");
      if (l) l.textContent = String(data.leads);
    } catch (_) {}
  }

  function productNameFromPage() {
    var p = window.currentProduct;
    return String((p && (p.name_ru || p.name)) || "").trim();
  }

  function clearLeadModalMessages() {
    var err = document.getElementById("leadModalErr");
    if (err) {
      err.textContent = "";
      err.classList.add("hidden");
    }
  }

  function showModalError(text) {
    var err = document.getElementById("leadModalErr");
    if (!err) return;
    err.textContent = text;
    err.classList.remove("hidden");
  }

  function showLeadToast(msg) {
    var id = "leadToastBar";
    var ex = document.getElementById(id);
    if (ex) ex.remove();
    var t = document.createElement("div");
    t.id = id;
    t.className = "lead-toast";
    t.setAttribute("role", "status");
    t.textContent = msg || "Заявка отправлена";
    document.body.appendChild(t);
    requestAnimationFrame(function () {
      t.classList.add("lead-toast--show");
    });
    setTimeout(function () {
      t.classList.remove("lead-toast--show");
      setTimeout(function () {
        t.remove();
      }, 350);
    }, 3200);
  }

  window.openLeadModal = function openLeadModal(productName) {
    var label = String(productName || "").trim() || "Запрос прайса";
    leadProductLabel = label;
    var el = document.getElementById("leadModal");
    if (!el) return;
    injectToastStyles();
    clearLeadModalMessages();
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var n = document.getElementById("leadModalProductName");
    if (n) n.textContent = label;
  };

  window.closeLeadModal = function closeLeadModal() {
    var el = document.getElementById("leadModal");
    if (!el) return;
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    clearLeadModalMessages();
  };

  window.openProductLeadModal = function openProductLeadModal() {
    var nm = productNameFromPage();
    openLeadModal(nm || "Товар");
  };

  window.closeProductLeadModal = window.closeLeadModal;

  window.submitLead = async function submitLead() {
    injectToastStyles();
    var nameEl = document.getElementById("leadFieldName");
    var phoneEl = document.getElementById("leadFieldPhone");
    var cityEl = document.getElementById("leadFieldCity");
    var commentEl = document.getElementById("leadFieldComment");

    var name = String(nameEl?.value || "").trim();
    var phone = String(phoneEl?.value || "").trim();
    var city = String(cityEl?.value || "").trim();
    var comment = String(commentEl?.value || "").trim();
    var product = leadProductLabel;

    clearLeadModalMessages();
    if (!name) {
      showModalError("Укажите имя.");
      return;
    }
    if (!phone) {
      showModalError("Укажите телефон.");
      return;
    }
    var phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      showModalError("Телефон: не менее 10 цифр.");
      return;
    }

    try {
      var res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          phone: phone,
          city: city,
          comment: comment,
          product: product,
        }),
      });
      var body = await res.json().catch(function () {
        return {};
      });
      if (res.status === 429) {
        showModalError("Слишком много заявок с вашего адреса. Попробуйте позже.");
        return;
      }
      if (res.status === 400 && body.error === "invalid_phone") {
        showModalError("Телефон: не менее 10 цифр.");
        return;
      }
      if (!res.ok) throw new Error("bad");
      if (body.success === false) throw new Error("rej");
      bumpLocalLeadStats();
      if (nameEl) nameEl.value = "";
      if (phoneEl) phoneEl.value = "";
      if (cityEl) cityEl.value = "";
      if (commentEl) commentEl.value = "";
      closeLeadModal();
      showLeadToast("Заявка отправлена");
    } catch (e) {
      showModalError("Не удалось отправить. Запустите сервер: node server.js");
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    injectToastStyles();
    var modal = document.getElementById("leadModal");
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeLeadModal();
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) closeLeadModal();
    });
  });
})();
