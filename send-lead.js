/**
 * Отправка заявки на CRM (POST /api/leads). Подключать после открытия <body>, до модулей.
 */
(function () {
  function normalizePhone(input) {
    var digits = String(input || "").replace(/\D/g, "");
    if (digits.startsWith("8")) {
      digits = "7" + digits.slice(1);
    }
    if (!digits.startsWith("7")) {
      digits = "7" + digits;
    }
    return "+" + digits;
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

  window.sendLead = async function sendLead() {
    var phone = prompt("Введите номер телефона:");
    if (phone === null) return;
    var trimmed = normalizePhone(String(phone).trim());
    if (trimmed.replace(/\D/g, "").length < 11) {
      alert("Укажите полный номер (10 цифр после +7).");
      return;
    }
    try {
      var res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Без имени",
          phone: trimmed,
          city: "",
          comment: "Заявка с сайта (кнопка «Получить прайс»)",
          message: "Заявка с сайта (кнопка «Получить прайс»)",
          product: "",
        }),
      });
      if (!res.ok) throw new Error("bad status");
      var body = await res.json().catch(function () {
        return {};
      });
      if (body.success === false) throw new Error("rejected");
      bumpLocalLeadStats();
      alert("Заявка отправлена");
    } catch (e) {
      alert("Не удалось отправить заявку. Запустите сервер: node server.js");
    }
  };
})();
