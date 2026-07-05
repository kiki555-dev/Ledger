// ==========================================================
// Ledger — калькулятор ROI / NPV / срока окупаемости
// ==========================================================

const form = document.getElementById('calc-form');
const errorEl = document.getElementById('form-error');

const npvValueEl = document.getElementById('npv-value');
const roiValueEl = document.getElementById('roi-value');
const paybackValueEl = document.getElementById('payback-value');
const profitValueEl = document.getElementById('profit-value');

const canvas = document.getElementById('cashflow-chart');
const ctx = canvas.getContext('2d');

// ---------- 1. Форматирование ----------

function formatMoney(value) {
  return Math.round(value).toLocaleString('ru-RU') + ' ₽';
}

function formatPercent(value) {
  return value.toFixed(1) + '%';
}

// ---------- 2. Основная логика расчёта ----------

function calculate({ investment, revenue, costs, period, rate }) {
  const monthlyNet = revenue - costs;          // чистый поток в месяц
  const monthlyRate = (rate / 100) / 12;       // месячная ставка дисконтирования

  // Накопленный (недисконтированный) денежный поток по месяцам,
  // начиная с -investment в "нулевой" точке
  const cumulativeFlow = [-investment];
  let running = -investment;

  // NPV: сумма дисконтированных потоков минус инвестиции
  let npv = -investment;

  let paybackMonth = null;

  for (let month = 1; month <= period; month++) {
    running += monthlyNet;
    cumulativeFlow.push(running);

    const discounted = monthlyNet / Math.pow(1 + monthlyRate, month);
    npv += discounted;

    if (paybackMonth === null && running >= 0) {
      paybackMonth = month;
    }
  }

  const totalProfit = monthlyNet * period; // прибыль без учёта дисконта
  const roi = investment > 0
    ? ((totalProfit - investment) / investment) * 100
    : 0;

  return { npv, roi, totalProfit, paybackMonth, cumulativeFlow, monthlyNet };
}

// ---------- 3. Анимация "счётчика" для hero-числа ----------

function animateValue(el, from, to, formatter, duration = 600) {
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out
    const current = from + (to - from) * eased;
    el.textContent = formatter(current);
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------- 4. Отрисовка графика на canvas ----------

function drawChart(cumulativeFlow) {
  // Ресайз canvas под реальный размер контейнера (для чёткости на retina)
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = canvas.clientWidth;
  const displayHeight = 220;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const paddingLeft = 10;
  const paddingRight = 10;
  const paddingTop = 16;
  const paddingBottom = 16;

  const plotWidth = displayWidth - paddingLeft - paddingRight;
  const plotHeight = displayHeight - paddingTop - paddingBottom;

  const min = Math.min(...cumulativeFlow, 0);
  const max = Math.max(...cumulativeFlow, 0);
  const range = max - min || 1;

  const xStep = plotWidth / (cumulativeFlow.length - 1);

  function toX(i) { return paddingLeft + i * xStep; }
  function toY(v) { return paddingTop + plotHeight - ((v - min) / range) * plotHeight; }

  // Нулевая линия
  const zeroY = toY(0);
  ctx.strokeStyle = 'rgba(159, 179, 168, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, zeroY);
  ctx.lineTo(displayWidth - paddingRight, zeroY);
  ctx.stroke();

  // Линия денежного потока, сегментами: зелёный выше нуля, рыжий ниже
  for (let i = 0; i < cumulativeFlow.length - 1; i++) {
    const x1 = toX(i), y1 = toY(cumulativeFlow[i]);
    const x2 = toX(i + 1), y2 = toY(cumulativeFlow[i + 1]);
    const isPositiveSegment = (cumulativeFlow[i] + cumulativeFlow[i + 1]) / 2 >= 0;

    ctx.strokeStyle = isPositiveSegment ? '#7FB69E' : '#D2694F';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Точка старта и точка конца
  ctx.fillStyle = '#C9A227';
  ctx.beginPath();
  ctx.arc(toX(cumulativeFlow.length - 1), toY(cumulativeFlow[cumulativeFlow.length - 1]), 4, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- 5. Валидация ----------

function readAndValidateForm() {
  const investment = parseFloat(form.investment.value);
  const revenue = parseFloat(form.revenue.value);
  const costs = parseFloat(form.costs.value);
  const period = parseInt(form.period.value, 10);
  const rate = parseFloat(form.rate.value);

  if ([investment, revenue, costs, period, rate].some(v => Number.isNaN(v))) {
    throw new Error('Заполните все поля числами.');
  }
  if (investment <= 0) {
    throw new Error('Начальные инвестиции должны быть больше нуля.');
  }
  if (period <= 0 || period > 120) {
    throw new Error('Горизонт расчёта — от 1 до 120 месяцев.');
  }
  if (revenue < 0 || costs < 0 || rate < 0) {
    throw new Error('Значения не могут быть отрицательными.');
  }

  return { investment, revenue, costs, period, rate };
}

// ---------- 6. Обновление UI после расчёта ----------

let previousNpv = 0;

function renderResults(result) {
  const { npv, roi, totalProfit, paybackMonth, cumulativeFlow } = result;

  animateValue(npvValueEl, previousNpv, npv, formatMoney);
  npvValueEl.classList.toggle('is-negative', npv < 0);
  previousNpv = npv;

  roiValueEl.textContent = formatPercent(roi);
  roiValueEl.classList.toggle('is-negative', roi < 0);
  roiValueEl.classList.toggle('is-positive', roi >= 0);

  paybackValueEl.textContent = paybackMonth
    ? `${paybackMonth} мес.`
    : 'не достигается';

  profitValueEl.textContent = formatMoney(totalProfit);
  profitValueEl.classList.toggle('is-negative', totalProfit < 0);
  profitValueEl.classList.toggle('is-positive', totalProfit >= 0);

  drawChart(cumulativeFlow);
}

// ---------- 7. Обработчик формы ----------

form.addEventListener('submit', (e) => {
  e.preventDefault();
  errorEl.textContent = '';

  try {
    const inputs = readAndValidateForm();
    const result = calculate(inputs);
    renderResults(result);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// Пересчитать график при ресайзе окна (без пересчёта чисел)
window.addEventListener('resize', () => {
  if (previousNpv !== 0) {
    // Перерисовываем последний расчёт при изменении размера
    form.dispatchEvent(new Event('submit'));
  }
});

// Автоматический первый расчёт при загрузке страницы (с дефолтными значениями)
window.addEventListener('DOMContentLoaded', () => {
  form.dispatchEvent(new Event('submit'));
});
