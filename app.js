'use strict';

const $ = (id) => document.getElementById(id);
const form = $('birth-form');
const hour = $('hour');
const solar = $('solar-date');
const lunarYear = $('lunar-year');
const lunarMonth = $('lunar-month');
const lunarDay = $('lunar-day');
const yearDate = $('year-date');
const grid = $('chart-grid');
const stage = $('chart-stage');
const casting = $('casting');
const castingStatus = $('casting-status');
const submit = form.querySelector('button[type=submit]');
const exampleButton = $('example');
const demoButton = $('demo');
const workbench = $('workbench');
const reading = $('reading');
const readingGrid = $('reading-grid');
const readingToc = $('reading-toc');
const readingMeta = $('reading-meta');
const readingLink = $('reading-link');
const expandEvidence = $('expand-evidence');
const branches = '子丑寅卯辰巳午未申酉戌亥';
const layout = [
  ['巳', 'si'], ['午', 'wu'], ['未', 'wei'], ['申', 'shen'],
  ['辰', 'chen'], ['酉', 'you'], ['卯', 'mao'], ['戌', 'xu'],
  ['寅', 'yin'], ['丑', 'chou'], ['子', 'zi'], ['亥', 'hai']
];
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
const months = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const numerals = '一二三四五六七八九十';
const groupNumerals = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'];
const days = Array.from({ length: 30 }, (_, i) => {
  if (i < 10) return '初' + numerals[i];
  if (i === 19) return '二十';
  if (i === 29) return '三十';
  return (i < 19 ? '十' : '廿') + numerals[i % 10];
});
const palaceThemes = {
  命宫: '自我与性格', 兄弟: '手足与同辈', 夫妻: '亲密与承诺', 子女: '子女与作品',
  财帛: '财务与资源', 疾厄: '身心与作息', 迁移: '外部与变动', 仆役: '人际与协作',
  官禄: '事业与专业', 田宅: '居所与家业', 福德: '精神与享受', 父母: '长辈与庇荫'
};
const transforms = ['禄', '权', '科', '忌'];
const example = { calendar: 'solar', date: '1996-05-17', time: 5, gender: '女' };
let chart;
let selectedBranch;
let horoscope;
let isCasting = false;
let tocObserver;
let printState = [];

function el(tag, cls, value) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (value != null) node.textContent = value;
  return node;
}
function option(value, label, disabled = false) {
  const element = el('option', '', label);
  element.value = value;
  element.disabled = disabled;
  return element;
}
function padDate(value) {
  return String(value).split('-').map((part, index) => index ? part.padStart(2, '0') : part).join('-');
}
function focusDate() {
  if (!chart) return today;
  const birth = padDate(chart.solarDate);
  return yearDate.value && yearDate.value >= birth ? yearDate.value : today;
}

yearDate.value = today;
yearDate.min = '1900-01-01';
yearDate.max = '2100-12-31';
solar.max = today;
lunarYear.max = String(Math.min(2100, Number(today.slice(0, 4))));
lunarYear.min = '1900';
lunarMonth.replaceChildren(option('', '月', true), ...months.map((m, i) => option(i + 1, m + '月')));
lunarDay.replaceChildren(option('', '日', true), ...days.map((d, i) => option(i + 1, d)));
hour.replaceChildren(
  option('', '选择时辰', true),
  option(0, '早子时 · 00:00–00:59')
);
for (let i = 1; i < 12; i += 1) {
  hour.append(option(i, branches[i] + '时 · ' + String(2 * i - 1).padStart(2, '0') + ':00–' + String(2 * i).padStart(2, '0') + ':59'));
}
hour.append(option(12, '晚子时 · 23:00–23:59'));
hour.value = '';

function updateCalendar() {
  const isLunar = form.elements.calendar.value === 'lunar';
  $('solar-fields').hidden = isLunar;
  $('lunar-fields').hidden = !isLunar;
  solar.disabled = isLunar;
  solar.required = !isLunar;
  for (const input of [lunarYear, lunarMonth, lunarDay, $('leap')]) {
    input.disabled = !isLunar;
    if (input.type !== 'checkbox') input.required = isLunar;
  }
}

function calculate(input) {
  const { astro } = window.iztro;
  const { date, time, gender, leap, calendar } = input;
  if (calendar === 'lunar') {
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) throw new Error('invalid lunar date');
    const checked = astro.byLunar(date, 0, gender, leap, true, 'zh-CN');
    const raw = checked.rawDates.lunarDate;
    if (raw.lunarYear !== year || raw.lunarMonth !== month || raw.lunarDay !== day || raw.isLeap !== leap) {
      throw new Error('invalid lunar date');
    }
    const solarDate = padDate(checked.solarDate);
    if (solarDate > today) throw new Error('future birth date');
    return time === 0 ? checked : astro.byLunar(date, time, gender, leap, true, 'zh-CN');
  }
  if (!date) throw new Error('invalid solar date');
  const result = astro.bySolar(date, time, gender, true, 'zh-CN');
  if (padDate(result.solarDate) > today) throw new Error('future birth date');
  return result;
}

function showChart(result, isExample) {
  chart = result;
  $('example-tag').hidden = !isExample;
  selectedBranch = chart.earthlyBranchOfSoulPalace;
  $('chart-empty').hidden = true;
  for (const id of ['chart-modes', 'chart-grid', 'chart-caption', 'palace-detail', 'reading-link']) {
    $(id).hidden = false;
  }
  yearDate.min = padDate(chart.solarDate);
  yearDate.max = '2100-12-31';
  yearDate.value = today < yearDate.min ? yearDate.min : today;
  const natal = document.querySelector('input[name=mode][value=natal]');
  if (natal) natal.checked = true;
  render();
  renderReading(ziweiReading(chart, today, focusDate()), isExample);
  reading.hidden = false;
}

function renderCard(card, number) {
  const article = el('article', 'reading-card' + (card.compact ? ' compact' : ''));
  article.id = 'card-' + card.id;
  const rail = el('div', 'card-rail');
  rail.append(el('span', 'card-index', String(number).padStart(2, '0')), el('h3', '', card.title));
  if (card.verdict) rail.append(el('p', 'card-verdict', card.verdict));
  const copy = el('div', 'reading-copy');
  for (const paragraph of card.paragraphs) copy.append(el('p', '', paragraph));
  if (card.items?.length) {
    const list = el('ul', 'reading-list');
    for (const [label, description] of card.items) {
      const entry = el('li');
      entry.append(el('strong', '', label), document.createTextNode(description));
      list.append(entry);
    }
    copy.append(list);
  }
  if (card.tags?.length) {
    const tags = el('div', 'reading-tags');
    for (const tag of card.tags) tags.append(el('span', 'tag', tag));
    copy.append(tags);
  }
  if (card.evidence) {
    const basis = el('details', 'reading-basis');
    basis.append(el('summary', '', '盘面依据'), el('p', '', card.evidence));
    copy.append(basis);
  }
  article.append(rail, copy);
  return article;
}

function renderReading(cards, isExample) {
  const groups = [];
  for (const card of cards) {
    let group = groups.find((item) => item.name === card.group);
    if (!group) {
      group = { name: card.group, cards: [], meta: readingLibrary.groupMeta[card.group] || {} };
      groups.push(group);
    }
    group.cards.push(card);
  }

  const fragment = document.createDocumentFragment();
  const sections = [];
  let number = 0;
  groups.forEach((group, groupIndex) => {
    const section = el('section', 'reading-group' + (group.meta.compact ? ' compact' : ''));
    section.id = 'group-' + groupIndex;
    const heading = el('header', 'group-heading');
    heading.append(
      el('span', 'group-index', groupNumerals[groupIndex] || String(groupIndex + 1)),
      el('h3', '', group.name),
      el('p', '', group.meta.note || '')
    );
    section.append(heading);
    const cardsWrap = el('div', 'group-cards' + (group.meta.compact ? ' compact-grid' : ''));
    for (const card of group.cards) {
      number += 1;
      cardsWrap.append(renderCard(card, number));
    }
    section.append(cardsWrap);
    fragment.append(section);
    sections.push(section);
  });
  readingGrid.replaceChildren(fragment);

  const links = sections.map((section, index) => {
    const link = el('a', '', groups[index].name);
    link.href = '#' + section.id;
    link.addEventListener('click', () => setTocCurrent(link));
    return link;
  });
  readingToc.replaceChildren(...links);
  if (tocObserver) tocObserver.disconnect();
  if ('IntersectionObserver' in window) {
    tocObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      const link = links.find((item) => item.hash === '#' + visible.target.id);
      if (link) setTocCurrent(link);
    }, { rootMargin: '-70px 0px -68% 0px' });
    sections.forEach((section) => tocObserver.observe(section));
  }

  readingMeta.textContent = chart.gender + '命 · ' + chart.fiveElementsClass + ' · ' + chart.solarDate +
    ' · ' + chart.time + ' · 共 ' + cards.length + ' 个维度 · 运限基准 ' + focusDate();
  $('reading-example').hidden = !isExample;
  expandEvidence.setAttribute('aria-expanded', 'false');
  expandEvidence.textContent = '展开全部依据';
  reading.hidden = false;
}

function setTocCurrent(link) {
  for (const item of readingToc.querySelectorAll('a')) {
    item.classList.toggle('current', item === link);
    if (item === link) item.setAttribute('aria-current', 'location');
    else item.removeAttribute('aria-current');
  }
}

function palaceName(palace) {
  return horoscope ? horoscope.data.palaceNames[palace.index] : palace.name;
}

function render() {
  if (!chart) return;
  const mode = document.querySelector('input[name=mode]:checked').value;
  $('year-tools').hidden = mode === 'natal';
  horoscope = undefined;
  if (mode !== 'natal') {
    try {
      if (!yearDate.value || !yearDate.validity.valid) throw new Error('invalid year date');
      const birthDate = padDate(chart.solarDate);
      if (yearDate.value < birthDate) {
        $('year-info').textContent = '参照日期需在出生日期当日或之后。';
      } else {
        const h = chart.horoscope(yearDate.value, 6);
        const data = mode === 'decadal' ? h.decadal : h.yearly;
        const rangePalace = chart.palaces.find((palace) => palace.index === data.index);
        const range = rangePalace ? rangePalace.decadal.range.join('–') : '';
        const label = mode === 'decadal' ? '大限 ' + range + ' 岁' : yearDate.value.slice(0, 4) + ' 流年';
        horoscope = { mode, data, h };
        $('year-info').textContent = data.heavenlyStem + data.earthlyBranch + ' · ' + label + ' · 四化 ' +
          data.mutagen.map((name, index) => name + '化' + transforms[index]).join('、');
      }
    } catch {
      $('year-info').textContent = '请选择有效日期。';
    }
  }

  grid.replaceChildren();
  for (const [branch, area] of layout) {
    const palace = chart.palaces.find((p) => p.earthlyBranch === branch);
    const button = el('button', 'palace branch-' + area);
    button.type = 'button';
    button.dataset.branch = branch;
    button.setAttribute('aria-pressed', String(selectedBranch === branch));
    const heading = el('div', 'palace-top');
    const name = el('span', 'palace-name', palaceName(palace));
    if (palace.isBodyPalace) name.append(el('span', 'body-label', '身'));
    heading.append(name);
    if (horoscope) heading.append(el('span', 'alt-name', '本' + palace.name));
    const changeFor = (star) => {
      if (!horoscope) return star.mutagen;
      const index = horoscope.data.mutagen.indexOf(star.name);
      return index >= 0 ? transforms[index] : '';
    };
    const showStar = (star) => {
      const item = el('span', '', star.name);
      const change = changeFor(star);
      if (change) {
        const stamp = el('span', 'mutagen', change);
        stamp.setAttribute('aria-label', '化' + change);
        item.append(stamp);
      }
      return item;
    };
    const stars = el('div', 'palace-main');
    stars.append(...palace.majorStars.map(showStar));
    if (!palace.majorStars.length) stars.append(el('span', 'alt-name', '无主星'));
    const minor = el('div', 'palace-minor');
    const visibleMinor = [...palace.minorStars]
      .sort((a, b) => Number(Boolean(changeFor(b))) - Number(Boolean(changeFor(a))))
      .slice(0, 3);
    minor.append(...visibleMinor.map(showStar));
    const foot = el('div', 'palace-foot');
    foot.append(el('span', '', palace.heavenlyStem + branch), el('span', '', palace.decadal.range.join('–')));
    button.append(heading, stars, minor, foot);
    button.setAttribute('aria-label', palaceName(palace) + '，' + branch + '宫，' +
      (palace.majorStars.length ? palace.majorStars.map((star) => star.name).join('、') : '无主星'));
    grid.append(button);
  }

  const center = el('div', 'chart-center');
  const scopeLabel = horoscope ? (horoscope.mode === 'decadal' ? '大限' : '流年') : '本命';
  center.append(
    el('div', 'center-symbol', scopeLabel),
    el('h3', '', chart.fiveElementsClass),
    el('p', '', chart.gender + '命 · ' + chart.zodiac + ' · ' + chart.time),
    el('p', '', '公历 ' + chart.solarDate),
    el('p', '', chart.lunarDate),
    el('p', '', chart.chineseDate),
    el('p', 'center-stars', '命主 ' + chart.soul + '　身主 ' + chart.body)
  );
  if (horoscope) {
    center.append(el('p', 'center-change', '四化 ' + horoscope.data.mutagen.map((name, index) => name + '化' + transforms[index]).join('、')));
  }
  grid.append(center);

  const soul = chart.palaces.find((palace) => palace.earthlyBranch === chart.earthlyBranchOfSoulPalace);
  const body = chart.palaces.find((palace) => palace.isBodyPalace);
  $('chart-caption').replaceChildren();
  const captionLeft = el('span', '', '本命 · ' + chart.fiveElementsClass + ' · 命宫在' + soul.earthlyBranch + (body ? ' · 身宫在' + body.earthlyBranch : ''));
  const captionRight = el('span', 'chart-caption-right');
  const readingLink = el('a', 'quiet-link', '阅读全盘解读');
  readingLink.href = '#reading';
  captionRight.append(el('span', '', '点击宫位可看详情'), document.createTextNode(' · '), readingLink);
  $('chart-caption').append(captionLeft, captionRight);
  showPalace();
}

function showPalace() {
  if (!chart) return;
  const palace = chart.palaces.find((p) => p.earthlyBranch === selectedBranch);
  if (!palace) return;
  const name = palaceName(palace);
  const detail = $('palace-detail');
  detail.replaceChildren(el('h3', '', name + ' · ' + (palaceThemes[name] || '宫位详情')));
  const row = (label, value) => {
    const p = el('p');
    p.append(el('b', '', label), document.createTextNode(value));
    detail.append(p);
  };
  const describe = (star) => {
    const tags = [star.brightness, star.mutagen && '化' + star.mutagen].filter(Boolean);
    return star.name + (tags.length ? '（' + tags.join('、') + '）' : '');
  };
  row('宫位', palace.heavenlyStem + palace.earthlyBranch + ' · 大限 ' + palace.decadal.range.join('–') + ' 岁' +
    (palace.isBodyPalace ? ' · 身宫' : '') + (horoscope ? ' · 本命' + palace.name : ''));
  const borrowed = !palace.majorStars.length;
  row('主星', palace.majorStars.length ? palace.majorStars.map(describe).join('、') : '无主星');
  row('辅星', palace.minorStars.length ? palace.minorStars.map(describe).join('、') : '无');
  if (palace.adjectiveStars.length) row('杂曜', palace.adjectiveStars.slice(0, 12).map((star) => star.name).join('、'));
  const opposite = chart.palaces.find((p) => p.index === (palace.index + 6) % 12);
  const wealth = chart.palaces.find((p) => p.index === (palace.index + 8) % 12);
  const career = chart.palaces.find((p) => p.index === (palace.index + 4) % 12);
  row('三方四正', [opposite, wealth, career].map((p) => p.name + '：' +
    (p.majorStars.length ? p.majorStars.map((star) => star.name).join('、') : '空')).join(' / '));
  if (borrowed) {
    row('空宫', opposite.majorStars.length ? '借对宫' + opposite.name + '的' + opposite.majorStars.map((star) => star.name).join('、') + '来读。' : '对宫也没有主星，先看三方四正与辅曜。');
  }
  if (horoscope) {
    const localNames = new Set([...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars].map((star) => star.name));
    const localChanges = horoscope.data.mutagen
      .map((star, index) => localNames.has(star) ? star + '化' + transforms[index] : '')
      .filter(Boolean);
    row((horoscope.mode === 'decadal' ? '大限' : '流年') + '星曜', (horoscope.data.stars[palace.index] || []).map((star) => star.name).join('、') || '无');
    row((horoscope.mode === 'decadal' ? '大限' : '流年') + '四化', localChanges.join('、') || '无');
  }
}

form.addEventListener('change', (event) => {
  if (event.target.name === 'calendar') updateCalendar();
});
form.addEventListener('input', () => { $('form-error').hidden = true; });
document.querySelectorAll('input[name=mode]').forEach((input) => input.addEventListener('change', render));
yearDate.addEventListener('change', () => {
  render();
  if (chart) renderReading(ziweiReading(chart, today, focusDate()), !$('reading-example').hidden);
});

async function revealChart(result) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (matchMedia('(max-width: 760px)').matches) {
    document.querySelector('.chart-card').scrollIntoView({ block: 'start' });
  }
  if (reducedMotion) {
    showChart(result, false);
    castingStatus.textContent = '命盘已生成。';
    return;
  }

  isCasting = true;
  submit.disabled = exampleButton.disabled = true;
  grid.inert = true;
  stage.setAttribute('aria-busy', 'true');
  castingStatus.textContent = '正在排盘。';
  casting.hidden = false;
  try {
    const animation = casting.animate([
      { opacity: 0 }, { opacity: 1, offset: .16 }, { opacity: 1, offset: .75 }, { opacity: 0 }
    ], { duration: 1050, easing: 'ease' });
    await animation.finished;
    showChart(result, false);
  } finally {
    casting.hidden = true;
    stage.removeAttribute('aria-busy');
    grid.inert = false;
    submit.disabled = exampleButton.disabled = false;
    isCasting = false;
  }
  castingStatus.textContent = '命盘已生成。';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (isCasting) return;
  if (hour.value === '') {
    const error = $('form-error');
    error.textContent = '请选择出生时辰。';
    error.hidden = false;
    return;
  }
  const calendar = form.elements.calendar.value;
  const date = calendar === 'solar' ? solar.value : [lunarYear.value, lunarMonth.value, lunarDay.value].join('-');
  let result;
  try {
    result = calculate({ calendar, date, time: Number(hour.value), gender: form.elements.gender.value, leap: $('leap').checked });
  } catch {
    const error = $('form-error');
    error.textContent = '请检查出生日期和闰月选项。出生日期须有效，且不能晚于今天。';
    error.hidden = false;
    return;
  }
  void revealChart(result);
});

function loadExample(go) {
  form.elements.calendar.value = 'solar';
  form.elements.gender.value = '女';
  solar.value = example.date;
  hour.value = String(example.time);
  $('leap').checked = false;
  updateCalendar();
  $('form-error').hidden = true;
  showChart(calculate(example), true);
  castingStatus.textContent = '已显示示例命盘。';
  if (go) {
    location.hash = '#chart';
    if (matchMedia('(max-width: 780px)').matches) {
      setTimeout(() => document.querySelector('.chart-card')?.scrollIntoView({ block: 'start' }), 80);
    }
  }
}

exampleButton.addEventListener('click', () => loadExample(false));
if (demoButton) {
  demoButton.addEventListener('click', (event) => {
    event.preventDefault();
    loadExample(true);
  });
}

grid.addEventListener('click', (event) => {
  const button = event.target.closest('.palace');
  if (!button) return;
  grid.querySelector('[aria-pressed=true]')?.setAttribute('aria-pressed', 'false');
  selectedBranch = button.dataset.branch;
  button.setAttribute('aria-pressed', 'true');
  showPalace();
});

expandEvidence.addEventListener('click', () => {
  const open = expandEvidence.getAttribute('aria-expanded') !== 'true';
  document.querySelectorAll('.reading-basis').forEach((details) => { details.open = open; });
  expandEvidence.setAttribute('aria-expanded', String(open));
  expandEvidence.textContent = open ? '收起全部依据' : '展开全部依据';
});

$('print').addEventListener('click', () => window.print());
window.addEventListener('beforeprint', () => {
  printState = [...document.querySelectorAll('.reading-basis')].map((details) => details.open);
  document.querySelectorAll('.reading-basis').forEach((details) => { details.open = true; });
});
window.addEventListener('afterprint', () => {
  document.querySelectorAll('.reading-basis').forEach((details, index) => { details.open = printState[index] ?? false; });
});

function route(focus) {
  const page = location.hash.slice(1) || 'start';
  const readingAnchor = page.startsWith('group-') || page.startsWith('card-');
  if (!chart && (page === 'reading' || readingAnchor)) {
    location.hash = '#chart';
    return;
  }
  const inWorkbench = ['chart', 'reading', 'guide'].includes(page) || readingAnchor;
  const wasInWorkbench = !workbench.hidden;
  const changedView = wasInWorkbench !== inWorkbench;
  $('start').hidden = inWorkbench;
  $('work-nav').hidden = !inWorkbench;
  workbench.hidden = !inWorkbench;
  $('work-nav').querySelectorAll('a').forEach((link) => {
    const active = link.hash === location.hash || (readingAnchor && link.hash === '#reading');
    link.classList.toggle('current', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  if (!focus) return;
  if (changedView) {
    const heading = inWorkbench ? $('work-title') : $('hero-title');
    heading.focus({ preventScroll: true });
    if (!inWorkbench || page === 'chart') {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
  }
  const target = $(page);
  if (target && !target.hidden) target.scrollIntoView({ block: 'start' });
  else window.scrollTo({ top: 0, behavior: 'auto' });
}

updateCalendar();
route(false);
window.addEventListener('hashchange', () => route(true));

const params = new URLSearchParams(location.search);
if (params.get('demo') === '1' || location.hash === '#demo') {
  setTimeout(() => loadExample(true), 0);
}
