'use strict';

const ziweiReading = (() => {
  const lib = typeof readingLibrary !== 'undefined' ? readingLibrary : require('./reading-library.js');
  const starLib = typeof starLibrary !== 'undefined' ? starLibrary : require('./star-library.js');

  const ORDER = ['禄', '权', '科', '忌'];
  const PALACES = lib.palaceOrder;
  const STRONG = new Set(['庙', '旺', '得', '利']);
  const WEAK = new Set(['不', '陷']);
  const SHA = new Set(['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']);
  const JI = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺']);
  const PATTERN_ORDER = ['shaPoLang', 'jiYueTongLiang', 'ziFu', 'riYue', 'juRi', 'yangLiangChangLu', 'sanQi', 'shuangLu', 'luJi', 'mingWuZheng', 'huoTan', 'yangTuoJiaJi', 'siMa', 'siMu', 'siTaoHua', 'jiYao', 'shaJu'];
  const STAR_ACTIONS = {
    紫微: '把一件你一直替别人拍板的事，交给别人决定一次，看看结果是否真的失控。',
    天机: '给一件反复考虑的事定两个方案，设一个决定日期；到日子就选一个。',
    太阳: '把最近做完的一件事整理成可展示的成果，让别人看见你的交付。',
    武曲: '给一件卡住的任务写下“做到什么算完成”，先交出一个版本。',
    天同: '练习用一句“我能帮到这里”说清自己的范围。',
    廉贞: '写下一件事的底线和可以商量的部分，再找人谈。',
    天府: '从一项重复的事情开始，写出一份三步流程，交给别人照着做。',
    太阴: '把一件想了很久的事做出初稿，找一个信任的人看。',
    贪狼: '选一个想法只试七天，到期再决定要不要延长。',
    巨门: '把一件争论中的事实、猜测和待核实的问题各写一行。',
    天相: '下一次合作，开始前先确认答应的是哪部分任务。',
    天梁: '挑一项能长期积累的本事，定一个本月可交付的成果。',
    七杀: '做决定前先说清两点：谁会受影响，哪种情况需要叫停。',
    破军: '找出眼下最费力的一步，只改这一步，留着原来的退路。'
  };

  const uniq = (items) => [...new Set(items.filter(Boolean))];
  const fmt = (items, sep = '、') => items.filter(Boolean).join(sep);
  const byName = (chart, name) => chart.palaces.find((palace) => palace.name === name);
  const byIndex = (chart, index) => chart.palaces.find((palace) => palace.index === index);
  const at = (chart, palace, offset) => byIndex(chart, (palace.index + offset + 12) % 12);
  const sanfang = (chart, palace) => {
    const opposite = at(chart, palace, 6);
    const wealth = at(chart, palace, 8);
    const career = at(chart, palace, 4);
    return { opposite, wealth, career, all: [palace, opposite, wealth, career] };
  };
  const allStars = (palace) => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
  const starLabel = (star) => star.name + (star.brightness ? '（' + star.brightness + '）' : '') + (star.mutagen ? '化' + star.mutagen : '');
  const nameOf = (star) => star.name;
  const firstSentence = (text) => {
    if (!text) return '';
    const cut = text.indexOf('。');
    return cut >= 0 ? text.slice(0, cut + 1) : text;
  };
  const trim = (text, max = 64) => text && text.length > max ? text.slice(0, max - 1) + '…' : text;
  const ask = (text) => text.replace(/[。？?！!]$/, '') + '？';
  const rank = (star) => (star && star.brightness ? lib.brightnessRank[star.brightness] ?? 2 : 2);
  const pickPrimary = (major) => {
    if (!major.length) return undefined;
    const score = (star) => rank(star) + (star.mutagen === '忌' ? 10 : star.mutagen ? 4 : 0);
    return major.slice().sort((a, b) => score(b) - score(a))[0];
  };
  const findStarPalace = (chart, name) => chart.palaces.find((palace) => allStars(palace).some((star) => star.name === name));
  const starByName = (name) => starLib[name];
  const entryOf = (name, palaceName) => starByName(name)?.palaces?.[palaceName];

  function inspect(chart, palace) {
    const opposite = at(chart, palace, 6);
    const borrowed = palace.majorStars.length === 0;
    let major = palace.majorStars;
    let borrowFrom;
    if (borrowed && opposite.majorStars.length) {
      major = opposite.majorStars;
      borrowFrom = opposite;
    }
    if (borrowed && !major.length) {
      const alt = sanfang(chart, palace).all.find((p) => p !== palace && p !== opposite && p.majorStars.length);
      if (alt) {
        major = alt.majorStars;
        borrowFrom = alt;
      }
    }
    const localStars = allStars(palace);
    const changes = localStars.filter((star) => star.mutagen);
    return { palace, opposite, borrowed, major, borrowFrom, localStars, changes };
  }

  function palaceEvidence(chart, palace) {
    const sf = sanfang(chart, palace);
    const other = [sf.opposite, sf.wealth, sf.career]
      .map((p) => p.name + '：' + (p.majorStars.length ? p.majorStars.map(nameOf).join('、') : '空'))
      .join(' / ');
    const minor = palace.minorStars.map(nameOf).join('、');
    const adj = palace.adjectiveStars.map(nameOf).slice(0, 8).join('、');
    return [
      palace.name + '在' + palace.heavenlyStem + palace.earthlyBranch,
      palace.majorStars.length ? palace.majorStars.map(starLabel).join('、') : '无主星',
      minor ? '辅曜 ' + minor : '',
      adj ? '杂曜 ' + adj : '',
      '三方四正 ' + other
    ].filter(Boolean).join(' · ');
  }

  function scopeChanges(chart, data) {
    return (data?.mutagen || []).map((name, index) => {
      const palace = findStarPalace(chart, name);
      return { star: name, type: ORDER[index], palace: palace ? palace.name : '未定位', palaceIndex: palace ? palace.index : -1 };
    }).filter((item) => item.palace !== '未定位');
  }

  function natalChanges(chart) {
    return chart.palaces.flatMap((palace) => allStars(palace)
      .filter((star) => star.mutagen)
      .map((star) => ({ star: star.name, type: star.mutagen, palace: palace.name, palaceIndex: palace.index })))
      .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  }

  function detectPatterns(chart) {
    const self = byName(chart, '命宫');
    const sf = sanfang(chart, self);
    const sfPalaces = sf.all;
    const sfMajor = new Set(sfPalaces.flatMap((p) => p.majorStars.map(nameOf)));
    const sfAll = new Set(sfPalaces.flatMap((p) => allStars(p).map(nameOf)));
    const changesInSf = natalChanges(chart).filter((change) => sfPalaces.some((p) => p.name === change.palace));
    const ids = [];
    const add = (id) => { if (!ids.includes(id)) ids.push(id); };

    if (['七杀', '破军', '贪狼'].every((name) => sfMajor.has(name))) add('shaPoLang');
    if (['天机', '太阴', '天同', '天梁'].every((name) => sfMajor.has(name))) add('jiYueTongLiang');
    if (['紫微', '天府'].every((name) => sfMajor.has(name))) add('ziFu');
    if (['太阳', '太阴'].every((name) => sfMajor.has(name))) add('riYue');
    if (sfPalaces.some((p) => p.majorStars.some((s) => s.name === '太阳') && p.majorStars.some((s) => s.name === '巨门'))) add('juRi');
    if (sfMajor.has('太阳') && sfMajor.has('天梁') && sfAll.has('文昌') &&
      (sfAll.has('禄存') || changesInSf.some((c) => c.type === '禄'))) add('yangLiangChangLu');
    if (['禄', '权', '科'].every((type) => changesInSf.some((c) => c.type === type))) add('sanQi');
    if (sfAll.has('禄存') && changesInSf.some((c) => c.type === '禄')) add('shuangLu');
    for (const palace of sfPalaces) {
      const hasLu = allStars(palace).some((s) => s.mutagen === '禄');
      const hasJi = allStars(palace).some((s) => s.mutagen === '忌');
      const opposite = at(chart, palace, 6);
      const oppLu = allStars(opposite).some((s) => s.mutagen === '禄');
      const oppJi = allStars(opposite).some((s) => s.mutagen === '忌');
      if ((hasLu && hasJi) || (hasLu && oppJi) || (oppLu && hasJi)) { add('luJi'); break; }
    }
    if (!self.majorStars.length) add('mingWuZheng');
    if (sfPalaces.some((p) => p.majorStars.some((s) => s.name === '贪狼') && allStars(p).some((s) => s.name === '火星' || s.name === '铃星'))) add('huoTan');
    for (const palace of chart.palaces) {
      if (!allStars(palace).some((s) => s.mutagen === '忌')) continue;
      const near = [...allStars(at(chart, palace, 1)), ...allStars(at(chart, palace, 11))].map(nameOf);
      if (near.includes('擎羊') && near.includes('陀罗')) { add('yangTuoJiaJi'); break; }
    }
    if ('寅申巳亥'.includes(self.earthlyBranch)) add('siMa');
    if ('辰戌丑未'.includes(self.earthlyBranch)) add('siMu');
    if ('子午卯酉'.includes(self.earthlyBranch)) add('siTaoHua');
    if ((sfAll.has('左辅') && sfAll.has('右弼')) || (sfAll.has('文昌') && sfAll.has('文曲')) ||
      (sfAll.has('天魁') && sfAll.has('天钺'))) add('jiYao');
    if ([...sfAll].filter((name) => SHA.has(name)).length >= 3) add('shaJu');

    return ids
      .sort((a, b) => PATTERN_ORDER.indexOf(a) - PATTERN_ORDER.indexOf(b))
      .map((id) => ({ id, ...lib.patterns[id] }));
  }

  function patternEvidence(patterns) {
    if (!patterns.length) return '命宫三方四正未见成组格局';
    return patterns.map((pattern) => pattern.label).join('、');
  }

  function readPalace(chart, palaceName) {
    const palace = byName(chart, palaceName);
    const info = inspect(chart, palace);
    const meta = lib.palaceMeta[palaceName];
    const primary = pickPrimary(info.major);
    const star = primary ? starByName(primary.name) : undefined;
    const entry = primary ? entryOf(primary.name, palaceName) : undefined;
    const paragraphs = [];
    const tags = [];

    if (info.borrowed) {
      paragraphs.push(info.borrowFrom
        ? '本宫无主星，借' + info.borrowFrom.name + '的' + info.major.map(nameOf).join('、') + '来读。空宫不是弱，而是可塑性强，更受环境与选择影响。'
        : '本宫无主星，对宫也没有主星，只能从三方四正与辅曜来读。这类宫位更看后天环境。');
    }
    if (entry) {
      paragraphs.push(entry[1]);
    } else if (star) {
      paragraphs.push(star.core + '这颗星落在这个宫位，具体表现要看它与哪些星同宫、又会照到哪里。');
    } else {
      paragraphs.push('这个宫位的主星线索较少，先把宫内辅曜与三方四正看清楚，再谈具体倾向。');
    }

    const secondary = info.major.find((starItem) => starItem !== primary);
    if (secondary) {
      const secondEntry = entryOf(secondary.name, palaceName);
      if (secondEntry) {
        const prefix = info.borrowed ? '借来的' + secondary.name : '同宫的' + secondary.name;
        paragraphs.push(prefix + '，让这件事多一层：' + firstSentence(secondEntry[1]));
      }
    }

    if (info.changes.length) {
      const change = info.changes[0];
      paragraphs.push(change.name + '化' + change.mutagen + '落在本宫。' + lib.transforms[change.mutagen].byPalace[palaceName]);
      tags.push('化' + change.mutagen);
    }

    if (primary && star && !info.borrowed) {
      if (WEAK.has(primary.brightness)) paragraphs.push(star.weak);
      else if (primary.brightness === '庙' || primary.brightness === '旺') paragraphs.push(star.strong);
    }

    const notable = info.localStars.filter((s) => lib.auxiliaries[s.name] && SHA.has(s.name)).slice(0, 1);
    if (notable.length) {
      const aux = lib.auxiliaries[notable[0].name];
      paragraphs.push(notable[0].name + '同宫，' + aux.core + '。' + (aux.shadow ? aux.shadow + '。' : ''));
    } else {
      const helper = info.localStars.filter((s) => lib.auxiliaries[s.name] && (JI.has(s.name) || s.name === '禄存' || s.name === '天马')).slice(0, 1);
      if (helper.length) {
        const aux = lib.auxiliaries[helper[0].name];
        paragraphs.push(helper[0].name + '同宫，' + aux.core + '。' + (aux.shadow ? aux.shadow + '。' : ''));
      }
    }

    if (star) tags.unshift(...star.keywords.slice(0, 2));
    tags.push(meta.theme);
    const verdict = info.borrowed
      ? (info.major.length
        ? '借' + (info.borrowFrom ? info.borrowFrom.name : '三方') + '的' + info.major.map(nameOf).join('、') + '入' + palaceName + '。'
        : '本宫与对宫皆无主星，先看三方四正与辅曜。')
      : entry?.[0] || (star ? star.alias + '临' + palaceName + '，' + star.keywords[0] + '是主线。' : palaceName + '无主星，先借三方来读。');
    return {
      palace, info, primary, star, entry, verdict,
      paragraphs: paragraphs.filter(Boolean).slice(0, 4),
      tags: uniq(tags).slice(0, 4),
      evidence: palaceEvidence(chart, palace)
    };
  }

  function card(data) {
    return {
      id: data.id,
      group: data.group,
      title: data.title,
      verdict: data.verdict || '',
      paragraphs: (data.paragraphs || []).filter(Boolean),
      items: (data.items || []).filter(Boolean),
      tags: uniq(data.tags || []),
      evidence: data.evidence || '',
      compact: Boolean(data.compact)
    };
  }

  function overviewCard(chart, patterns) {
    const self = byName(chart, '命宫');
    const info = inspect(chart, self);
    const primary = pickPrimary(info.major);
    const star = primary ? starByName(primary.name) : undefined;
    const body = chart.palaces.find((palace) => palace.isBodyPalace);
    const sf = sanfang(chart, self);
    const changes = natalChanges(chart);
    const oppositeLine = sf.opposite.majorStars.length
      ? sf.opposite.name + '见' + sf.opposite.majorStars.map(nameOf).join('、')
      : sf.opposite.name + '也空';
    const sideLine = [sf.wealth, sf.career]
      .map((p) => p.name + (p.majorStars.length ? '见' + p.majorStars.map(nameOf).join('、') : '空'))
      .join('，');

    const first = info.borrowed
      ? (info.borrowFrom
        ? '命宫无主星，借' + info.borrowFrom.name + '的' + info.major.map(nameOf).join('、') + '来读，落在' + self.heavenlyStem + self.earthlyBranch + '。'
        : '命宫与对宫皆无主星，先看三方四正与辅曜，落在' + self.heavenlyStem + self.earthlyBranch + '。')
      : '命宫' + info.major.map(starLabel).join('、') + '，落在' + self.heavenlyStem + self.earthlyBranch + '。';
    const coreLine = star ? star.core : '这张盘的自我线索不在主星上，更受对宫、三方与后天环境塑造。';
    const structureLine = patterns.length
      ? '盘面结构上，' + patterns.slice(0, 3).map((p) => p.label).join('、') + '最值得先看。'
      : '命宫三方没有落在特别典型的成组格局里，更看单星、亮度与宫位互动。';
    const bodyLine = body
      ? body.name === '命宫'
        ? '身宫与命宫同宫，你表里相对一致，但也容易把“我是谁”看得太重；学会把自己放进一件具体的事里，而不是只在内心里打磨。'
        : '身宫落' + body.name + '，' + lib.palaceMeta[body.name].theme + '是你的第二命宫。你嘴上说不在意的事，往往在这里最容易被牵动。'
      : '';
    const changeLine = changes.length
      ? '生年四化：' + changes.map((c) => c.star + '化' + c.type + '在' + c.palace).join('、') + '。这四化不是四个好坏标签，而是你一生最容易投入、最想掌权、最在意口碑、也最容易反复的四条线。'
      : '';

    return card({
      id: 'overview',
      group: '总览',
      title: '命盘总论',
      verdict: info.borrowed
        ? (info.major.length
          ? '空宫借星，' + (star ? star.alias + '的' + star.keywords.slice(0, 2).join('、') : '三方主星') + '是你绕不开的底色。'
          : '命宫与对宫皆无主星，先看三方四正与后天选择。')
        : star
          ? star.alias + '临命，' + star.keywords[0] + '与' + star.keywords[1] + '是你绕不开的底色。'
          : '命宫无正曜，你更像一张可塑性很强的盘。',
      paragraphs: [
        first + coreLine,
        formatSfLine(oppositeLine, sideLine) + structureLine,
        bodyLine,
        changeLine,
        star ? '一句话：' + star.summary : ''
      ],
      tags: uniq([...(star?.keywords || []), ...patterns.slice(0, 2).map((p) => p.label), body ? '身宫在' + body.name : '']).slice(0, 4),
      evidence: [
        palaceEvidence(chart, self),
        body ? '身宫在' + body.name : '',
        '结构：' + patternEvidence(patterns),
        changes.length ? '生年四化：' + changes.map((c) => c.star + '化' + c.type + '在' + c.palace).join('、') : ''
      ].filter(Boolean).join(' / ')
    });
  }

  function formatSfLine(oppositeLine, sideLine) {
    return '对宫' + oppositeLine + '；' + sideLine + '。';
  }

  function characterCard(chart) {
    const self = readPalace(chart, '命宫');
    const spirit = readPalace(chart, '福德');
    const move = readPalace(chart, '迁移');
    const body = chart.palaces.find((palace) => palace.isBodyPalace);
    const primary = self.primary;
    const star = primary ? starByName(primary.name) : undefined;

    const inner = spirit.entry ? '福德宫：' + spirit.entry[0] + spirit.entry[1] : '福德宫：' + spirit.paragraphs[0];
    const outer = move.entry ? '迁移宫：' + move.entry[0] + move.entry[1] : '迁移宫：' + move.paragraphs[0];
    const bodyLine = body
      ? body.name === '命宫'
        ? '身宫与命宫同宫。你不太容易被外界带偏，但也很容易把自己困在自我评价里；多让具体的事给你反馈，比反复内省有用。'
        : '身宫在' + body.name + '。' + lib.palaceMeta[body.name].theme + '不是你的全部，却是你最容易被牵动的地方；关系、工作或家宅一有风吹草动，你很难真的置身事外。'
      : '';

    return card({
      id: 'character',
      group: '总览',
      title: '性格与气质',
      verdict: self.verdict,
      paragraphs: [
        (star ? (self.info.borrowed ? '借来的' + star.alias + '入命：' : '先看你给人的第一眼：') + star.core : self.paragraphs[0]),
        inner,
        outer,
        bodyLine
      ],
      tags: uniq([...(self.tags || []), '内在:' + lib.palaceMeta['福德'].theme]).slice(0, 4),
      evidence: [self.evidence, spirit.evidence, move.evidence, body ? '身宫在' + body.name : ''].filter(Boolean).join(' / ')
    });
  }

  function patternCard(chart, patterns) {
    if (!patterns.length) {
      return card({
        id: 'patterns',
        group: '总览',
        title: '格局与结构',
        verdict: '这张盘不成特别的组，反而更看单星与宫位互动。',
        paragraphs: [
          '命宫三方四正没有落在杀破狼、机月同梁、紫府、日月这类典型结构里。这不是“没有格局”，而是说你的路更依赖具体选择，而不是一个现成的模板。',
          '看这类盘，先看命宫主星的亮度与四化，再看身宫落在哪里、哪一宫被引动得最多。单星看得准，比套一个格局名更有用。'
        ],
        tags: ['单星结构', '看选择'],
        evidence: patternEvidence(patterns)
      });
    }
    const main = patterns[0];
    return card({
      id: 'patterns',
      group: '总览',
      title: '格局与结构',
      verdict: main.label + '：' + main.short + '。',
      paragraphs: [
        patterns.length > 1
          ? '这张盘不止一个结构，先看' + patterns.slice(0, 2).map((p) => p.label).join('与') + '，再看它们怎么互相牵制。'
          : '这张盘的主结构是' + main.label + '，它决定了你最容易在哪种局面里出头，也决定了你最容易在哪里用力过猛。',
        ...patterns.slice(0, 3).map((p) => p.text),
        patterns.length > 3 ? '另外还见' + patterns.slice(3).map((p) => p.label).join('、') + '；这些结构会互相牵制，不必分开看。' : ''
      ],
      tags: patterns.slice(0, 4).map((p) => p.label),
      evidence: patternEvidence(patterns)
    });
  }

  function fourChangesCard(chart) {
    const changes = natalChanges(chart);
    const group = (type) => changes.filter((c) => c.type === type);
    const describe = (type) => {
      const items = group(type);
      if (!items.length) return '';
      return items.map((c) => '化' + type + '在' + c.palace + '：' + lib.transforms[type].byPalace[c.palace]).join(' ');
    };
    const first = changes[0];
    const verdict = first
      ? '你这一生最容易反复的功课，落在' + group('忌').map((c) => c.palace).join('、') + '。'
      : '这张盘的四化线索不强，更看宫位本身的星曜组合。';

    return card({
      id: 'four-changes',
      group: '总览',
      title: '四化与人生课题',
      verdict,
      paragraphs: [
        '四化是紫微斗数里最像“人生剧本”的一层：禄是你愿意投入的，权是你想掌住的，科是你在意的体面与专业，忌是你反复绕不出去的地方。',
        describe('禄') || '生年没有化禄，机会更多要靠自己主动去找。',
        describe('权') || '生年没有化权，主导权多半要在具体事情里慢慢挣。',
        describe('科') || '生年没有化科，口碑要靠作品一点点攒。',
        describe('忌') || '生年没有化忌，课题更分散，跟着具体运限走。'
      ],
      tags: uniq(changes.map((c) => '化' + c.type)).slice(0, 4),
      evidence: changes.map((c) => c.star + '化' + c.type + '在' + c.palace).join(' / ')
    });
  }

  function palaceCards(chart) {
    return PALACES.map((name, index) => {
      const reading = readPalace(chart, name);
      return card({
        id: 'palace-' + name,
        group: '十二宫',
        title: name + ' · ' + lib.palaceMeta[name].theme,
        verdict: reading.verdict,
        paragraphs: reading.paragraphs,
        tags: reading.tags,
        evidence: reading.evidence,
        compact: true
      });
    });
  }

  function careerCard(chart, patterns, timing) {
    const work = readPalace(chart, '官禄');
    const self = readPalace(chart, '命宫');
    const move = readPalace(chart, '迁移');
    const money = readPalace(chart, '财帛');
    const workStar = work.star;
    const selfStar = self.star;
    const current = timing.decade;
    const scope = timing.focus.decadal;
    const changes = scopeChanges(chart, scope);
    const workChange = changes.find((c) => c.palace === '官禄' || c.palace === '命宫');
    const patternLine = patterns.length ? '盘面结构是' + patterns.slice(0, 2).map((p) => p.label).join('、') + '，这决定了你适合在什么节奏里做事。' : '';

    return card({
      id: 'career',
      group: '专题',
      title: '事业与专业',
      verdict: work.entry?.[0] || work.verdict,
      paragraphs: [
        lib.topicIntros.career,
        work.paragraphs.slice(0, 2).join(''),
        '把命宫与迁移一起看：' + (selfStar ? selfStar.keywords[0] + '是你的发动机。' : '') +
          (move.paragraphs.length ? '迁移宫：' + move.paragraphs.slice(0, 2).join('') : '你适合在外部环境里试出自己真正的位置。') + patternLine,
        current ? '现在走' + current.decadal.range.join('–') + '岁大限，大限命宫在本命' + current.name + '。' +
          (workChange ? workChange.star + '化' + workChange.type + '入' + workChange.palace + '，' + lib.transforms[workChange.type].byPalace[workChange.palace] : '事业的重点不在猛冲，而在把一件事做深。') : ''
      ],
      items: [
        ['适合的工作方式', workStar ? workStar.keywords.join('、') + '；' + firstSentence(workStar.strong) : '先找一件能持续积累的事。'],
        ['容易卡住的地方', work.info.localStars.some((s) => SHA.has(s.name)) ? '官禄宫见' + work.info.localStars.filter((s) => SHA.has(s.name)).map(nameOf).join('、') + '，容易在细节、人际或反复返工上耗神。' : '真正的卡点多半不是能力，而是你把标准定得太高、迟迟不交付。'],
        ['现在的落点', current ? current.decadal.range.join('–') + '岁是' + current.name + '大限，先把这一阶段的作品做出来，再谈下一步。' : '先做出一件能被别人看见的成果。']
      ],
      tags: uniq([...(workStar?.keywords || []), ...(selfStar?.keywords || []), '大限:' + (current?.name || '—')]).slice(0, 4),
      evidence: [work.evidence, self.evidence, move.evidence, '大限四化：' + changes.map((c) => c.star + '化' + c.type + '在' + c.palace).join('、')].filter(Boolean).join(' / ')
    });
  }

  function moneyCard(chart, timing) {
    const money = readPalace(chart, '财帛');
    const home = readPalace(chart, '田宅');
    const spirit = readPalace(chart, '福德');
    const moneyPalaces = new Set(['命宫', '财帛', '田宅', '福德']);
    const lu = natalChanges(chart).filter((c) => c.type === '禄' && moneyPalaces.has(c.palace));
    const ji = natalChanges(chart).filter((c) => c.type === '忌' && moneyPalaces.has(c.palace));
    const hasLucun = chart.palaces.some((p) => allStars(p).some((s) => s.name === '禄存'));
    const current = timing.decade;
    const changes = scopeChanges(chart, timing.focus.decadal);
    const moneyChange = changes.find((c) => c.palace === '财帛' || c.palace === '田宅');

    return card({
      id: 'money',
      group: '专题',
      title: '财富与资源',
      verdict: money.entry?.[0] || money.verdict,
      paragraphs: [
        lib.topicIntros.money,
        money.paragraphs.slice(0, 2).join(''),
        '钱能不能留下，要看田宅。' + home.paragraphs.slice(0, 1).join('') +
          '福德宫则决定你花钱是为了安心、体面，还是开心：' + spirit.verdict,
        (hasLucun ? '盘上有禄存，手上是留得住资源的。' : '') +
          (lu.length ? '生年化禄在' + lu.map((c) => c.palace).join('、') + '，钱上的机会多从这些地方来。' : '生年化禄不在财位，钱上的机会更多要靠自己开拓。') +
          (ji.length ? '化忌在' + ji.map((c) => c.palace).join('、') + '，钱上最容易在这些地方反复。' : '')
      ],
      items: [
        ['进账方式', money.star ? money.star.keywords.join('、') + '；' + firstSentence(money.star.core) : '先记清实际到手的钱。'],
        ['留钱方式', '把固定开支、备用金和长期储备分成三笔，先看住房成本。'],
        ['现在的提醒', current ? '现在' + current.decadal.range.join('–') + '岁，' + (moneyChange ? moneyChange.star + '化' + moneyChange.type + '入' + moneyChange.palace + '，' + lib.transforms[moneyChange.type].byPalace[moneyChange.palace] : '先把现金流稳住，再谈扩张。') : '先留出六个月的备用金。']
      ],
      tags: uniq([...(money.star?.keywords || []), ...(home.star?.keywords || []), '化禄:' + (lu[0]?.palace || '无')]).slice(0, 4),
      evidence: [money.evidence, home.evidence, spirit.evidence, '生年四化：' + natalChanges(chart).map((c) => c.star + '化' + c.type + '在' + c.palace).join('、')].join(' / ')
    });
  }

  function loveCard(chart, timing) {
    const love = readPalace(chart, '夫妻');
    const child = readPalace(chart, '子女');
    const body = chart.palaces.find((palace) => palace.isBodyPalace);
    const loveStars = allStars(byName(chart, '夫妻'));
    const flowers = loveStars.filter((s) => ['红鸾', '天喜', '天姚', '咸池'].includes(s.name)).map(nameOf);
    const ji = natalChanges(chart).filter((c) => c.type === '忌');
    const loveJi = ji.find((c) => c.palace === '夫妻');
    const current = timing.decade;
    const changes = scopeChanges(chart, timing.focus.decadal);
    const loveChange = changes.find((c) => c.palace === '夫妻');

    return card({
      id: 'love',
      group: '专题',
      title: '亲密与承诺',
      verdict: love.entry?.[0] || love.verdict,
      paragraphs: [
        lib.topicIntros.love,
        love.paragraphs.slice(0, 2).join(''),
        '身宫在' + (body ? body.name : '—') + '，' + (body ? lib.palaceMeta[body.name].theme : '') +
          '是你最容易被牵动的地方。' + (body?.name === '夫妻'
            ? '关系一有波动，你的自我价值感也会跟着晃；这不是黏人，是你真的把关系放进了命里。'
            : body?.name === '命宫'
              ? '你更需要先安顿自己，关系才不会变成自我价值的唯一考场。'
              : '关系之外，你还需要一个能安放自己的支点。'),
        (loveJi ? '生年' + loveJi.star + '化忌在夫妻，关系里的功课容易反复：越在意，越想确认；越确认，越容易把对方推远。' : '') +
          (loveChange ? '现在这步大限，' + loveChange.star + '化' + loveChange.type + '入夫妻，' + lib.transforms[loveChange.type].byPalace['夫妻'] : '')
      ],
      items: [
        ['你的关系底色', love.star ? love.star.keywords.join('、') + '；' + firstSentence(love.star.core) : '先把最在意的一条约定说清。'],
        ['容易踩的坑', loveJi ? '把在意变成控制，用试探代替提问。' : '把体谅变成憋着，最后一次性爆发。'],
        ['可以练的事', flowers.length ? '盘上有' + flowers.join('、') + '，关系里的热度不缺；缺的是把热度落到具体约定上。' : '把一件小事说具体：见面频率、忙时怎么联络、各自需要多少独处。'],
        ['现在的落点', current ? current.decadal.range.join('–') + '岁走' + current.name + '大限，关系与合作的权重在上升；别用忙来回避一次该谈的谈话。' : '挑一件眼前的小事，把边界讲清。']
      ],
      tags: uniq([...(love.star?.keywords || []), '身宫:' + (body?.name || '—'), ...(flowers.slice(0, 1))]).slice(0, 4),
      evidence: [love.evidence, child.evidence, body ? '身宫在' + body.name : '', loveJi ? loveJi.star + '化忌在夫妻' : ''].filter(Boolean).join(' / ')
    });
  }

  function familyCard(chart) {
    const names = ['父母', '兄弟', '夫妻', '子女', '田宅'];
    const readings = names.map((name) => ({ name, reading: readPalace(chart, name) }));
    const items = readings.map(({ name, reading }) => [
      name + ' · ' + lib.palaceMeta[name].theme,
      lib.familyOpenings[name] + (reading.entry ? reading.entry[1] : reading.paragraphs[0])
    ]);
    return card({
      id: 'family',
      group: '专题',
      title: '家宅与六亲',
      verdict: '六亲不是六张卷子，是一张关系网。',
      paragraphs: [
        lib.topicIntros.family,
        '父母宫看你怎么接住长辈的期待，兄弟宫看同辈之间的分寸，子女宫看你对晚辈与作品的态度，田宅宫看一个家真正的秩序。',
        '这几个宫位不必分开看：它们常常是同一件事的不同侧面。你在父母那里学会的相处方式，很容易带到伴侣、孩子和团队身上。'
      ],
      items,
      tags: ['父母', '兄弟', '子女', '田宅'],
      evidence: readings.map(({ reading }) => reading.evidence).join(' / ')
    });
  }

  function socialCard(chart) {
    const friends = readPalace(chart, '仆役');
    const move = readPalace(chart, '迁移');
    const siblings = readPalace(chart, '兄弟');
    const friendsStars = allStars(byName(chart, '仆役'));
    const helpers = friendsStars.filter((s) => JI.has(s.name)).map(nameOf);
    const sha = friendsStars.filter((s) => SHA.has(s.name)).map(nameOf);

    return card({
      id: 'social',
      group: '专题',
      title: '人际与协作',
      verdict: friends.entry?.[0] || friends.verdict,
      paragraphs: [
        lib.topicIntros.social,
        friends.paragraphs.slice(0, 2).join(''),
        '你在熟人圈里是一套样子，到了外部环境又是另一套。' + (move.paragraphs.length ? '迁移宫：' + move.paragraphs.slice(0, 2).join('') : '外部环境会逼出你更真实的一面。'),
        (helpers.length ? '盘上有' + helpers.join('、') + '，合作里不缺把话说清、把记录留下来的能力；' : '') +
          (sha.length ? '也有' + sha.join('、') + '，关系里容易有直接的摩擦。' : '') +
          '把“谁能决定什么、什么时候退出”提前说清，比事后讲情分有用。'
      ],
      items: [
        ['你吸引来的圈子', friends.star ? '你会被' + friends.star.keywords.join('、') + '型的人吸引；先看你在什么场合最放松。' : '先看你在什么场合最放松。'],
        ['适合的合作方式', helpers.length ? '盘上有' + helpers.join('、') + '，合作里不缺助力；把分工和记录写清，比只讲情分有用。' : '先把分工写下来，再谈感情。'],
        ['要留心的关系', sha.length ? sha.join('、') + '同宫，容易遇到说话直、节奏快或临时变卦的人；把退出条件提前说好。' : '最容易耗你的，往往是那些不好意思拒绝的人。']
      ],
      tags: uniq([...(friends.star?.keywords || []), '迁移', '合作']).slice(0, 4),
      evidence: [friends.evidence, move.evidence, siblings.evidence].join(' / ')
    });
  }

  function healthCard(chart) {
    const health = readPalace(chart, '疾厄');
    const spirit = readPalace(chart, '福德');
    const self = readPalace(chart, '命宫');
    const healthStars = allStars(byName(chart, '疾厄'));
    const sha = healthStars.filter((s) => SHA.has(s.name)).map(nameOf);
    const ji = natalChanges(chart).filter((c) => c.type === '忌' && c.palace === '疾厄');

    return card({
      id: 'health',
      group: '专题',
      title: '身心与节律',
      verdict: health.entry?.[0] || health.verdict,
      paragraphs: [
        lib.topicIntros.health,
        health.paragraphs.slice(0, 2).join(''),
        '身体的问题常常先从情绪和生活节律里露头。福德宫：' + spirit.paragraphs.slice(0, 2).join(''),
        (sha.length ? '疾厄宫见' + sha.join('、') + '，压力容易走急症、旧伤或反复的路子；' : '') +
          (ji.length ? '生年' + ji[0].star + '化忌在疾厄，老毛病容易反复，定期检查比硬扛有用；' : '') +
          '这一篇只谈倾向与习惯，身体有持续不适时，以医疗专业意见为准。'
      ],
      items: [
        ['先守的节律', '睡眠、吃饭、活动量，先守住一项，不要同时改全部。'],
        ['容易忽略的信号', sha.length ? sha.join('、') + '提示你容易硬撑或突发；累了就停，不要等事情做完。' : '小毛病拖久了才看，是你最常犯的错。'],
        ['恢复方式', spirit.entry ? spirit.entry[0] + '先找一件不产出的事，让脑子真正松下来。' : '找一件不产出的事，让脑子真正松下来。']
      ],
      tags: uniq([...(health.star?.keywords || []), '作息', ...sha.slice(0, 1)]).slice(0, 4),
      evidence: [health.evidence, spirit.evidence, self.evidence].join(' / ')
    });
  }

  function decadeFor(chart, age) {
    const sorted = chart.palaces.slice().sort((a, b) => a.decadal.range[0] - b.decadal.range[0]);
    return sorted.find((p) => p.decadal.range[0] <= age && age <= p.decadal.range[1]) || sorted[sorted.length - 1];
  }

  function decadeTheme(chart, palace, data) {
    const major = palace.majorStars[0];
    const star = major ? starByName(major.name) : undefined;
    const meta = lib.palaceMeta[palace.name];
    return star ? meta.theme + '（' + star.keywords.slice(0, 2).join('、') + '）' : meta.theme;
  }

  function decadalCard(chart, timing) {
    const age = timing.age;
    const current = decadeFor(chart, age);
    const scope = timing.focus.decadal;
    const changes = scopeChanges(chart, scope);
    const next = chart.palaces
      .filter((p) => p.decadal.range[0] > current.decadal.range[0])
      .sort((a, b) => a.decadal.range[0] - b.decadal.range[0])
      .slice(0, 5);
    const currentStar = current.majorStars[0] ? starByName(current.majorStars[0].name) : undefined;
    const keyChange = changes.find((c) => c.type === '忌') || changes.find((c) => c.type === '禄') || changes[0];

    return card({
      id: 'decadal',
      group: '运限',
      title: '大限走势',
      verdict: '现在走' + current.decadal.range.join('–') + '岁大限，大限命宫在本命' + current.name + '。',
      paragraphs: [
        '按虚岁，你现在 ' + age + ' 岁，行 ' + current.decadal.range.join('–') + ' 岁大限。大限命宫落在本命' + current.name + '（' + lib.palaceMeta[current.name].theme + '），所以这十年的主题不是抽象的“好运或坏运”，而是' + decadeTheme(chart, current) + '。',
        (currentStar ? currentStar.core : '') + '这十年最容易发生的，是你会反复回到「' + (currentStar ? currentStar.keywords.join('、') : lib.palaceMeta[current.name].theme) + '」这个主题上。',
        changes.length
          ? '大限四化：' + changes.map((c) => c.star + '化' + c.type + '入本命' + c.palace).join('、') + '。' +
            (keyChange ? '其中' + keyChange.star + '化' + keyChange.type + '最值得留意：' + lib.transforms[keyChange.type].byPalace[keyChange.palace] : '')
          : '这步大限的四化线索不强，重点看大限命宫与三方四正。',
        next[0] ? '下一步 ' + next[0].decadal.range.join('–') + ' 岁走' + next[0].name + '，主题会转到' + lib.palaceMeta[next[0].name].theme + '；现在就可以留一点余量，不必把所有事都压在这一步。' : ''
      ],
      items: [
        [current.decadal.range.join('–') + ' 岁 · ' + current.name + '（现在）', decadeTheme(chart, current, scope) + '。' + (keyChange ? '重点：' + keyChange.star + '化' + keyChange.type + '。' : '')],
        ...next.map((p) => [p.decadal.range.join('–') + ' 岁 · ' + p.name, decadeTheme(chart, p, scope) + '。'])
      ],
      tags: uniq([current.name, ...(currentStar?.keywords || []), '虚岁' + age]).slice(0, 4),
      evidence: [palaceEvidence(chart, current), '大限命宫：本命' + current.name, '大限四化：' + changes.map((c) => c.star + '化' + c.type + '在' + c.palace).join('、')].filter(Boolean).join(' / ')
    });
  }

  function yearData(chart, year, birthDate) {
    let date = year + '-07-01';
    if (date < birthDate) date = birthDate;
    const h = chart.horoscope(date, 6);
    const palace = byIndex(chart, h.yearly.index);
    return { year, date, h, palace, changes: scopeChanges(chart, h.yearly), data: h.yearly };
  }

  function yearLine(chart, item) {
    const meta = lib.palaceMeta[item.palace.name];
    const key = item.changes.find((c) => c.type === '忌') || item.changes.find((c) => c.type === '禄') || item.changes[0];
    return '流年命宫落本命' + item.palace.name + '（' + meta.theme + '）。' +
      (key ? key.star + '化' + key.type + '入' + key.palace + '，' + lib.transforms[key.type].byPalace[key.palace] : '四化线索不强，跟着大限走。');
  }

  function yearlyCard(chart, timing, birthDate) {
    const base = timing.year;
    const years = [base, base + 1, base + 2].map((year) => yearData(chart, year, birthDate));
    const first = years[0];
    const firstMeta = lib.palaceMeta[first.palace.name];
    const firstKey = first.changes.find((c) => c.type === '忌') || first.changes.find((c) => c.type === '禄') || first.changes[0];
    const firstMajor = first.palace.majorStars[0];
    const firstStar = firstMajor ? starByName(firstMajor.name) : undefined;
    const fixedStar = firstMajor ? '本命' + firstMajor.name + '被推到台前，' + (firstStar ? firstStar.core : '') : '';

    return card({
      id: 'yearly',
      group: '运限',
      title: '流年与近三年',
      verdict: base + ' 年，流年命宫落本命' + first.palace.name + '，主题是' + firstMeta.theme + '。',
      paragraphs: [
        '流年不是另一张命盘，而是本命被某一年的四化与宫位点亮。' + base + ' 年，流年命宫在本命' + first.palace.name + '。这一年的主线是' + firstMeta.theme + '。最值得留意的是：' + ask(firstMeta.question) + fixedStar,
        first.changes.length
          ? '流年四化：' + first.changes.map((c) => c.star + '化' + c.type + '入本命' + c.palace).join('、') + '。' +
            (firstKey ? '其中' + firstKey.star + '化' + firstKey.type + '最容易被你感受到：' + lib.transforms[firstKey.type].byPalace[firstKey.palace] : '')
          : '这一年的四化线索不强，更多看流年命宫与大限的叠加。',
        first.palace.name === timing.decade.name
          ? '流年命宫与大限命宫重合，这一年的主题会被放大；好事坏事都容易来得更明显。'
          : '流年命宫与本命' + timing.decade.name + '大限不同，这一年更像是在大主题里处理一个具体章节。',
        '流年只写主题与容易触发的地方，不写成具体事件。'
      ],
      items: years.map((item) => [
        item.year + ' · ' + item.data.heavenlyStem + item.data.earthlyBranch + '年',
        yearLine(chart, item)
      ]),
      tags: uniq([String(base), first.palace.name, ...(firstStar?.keywords || [])]).slice(0, 4),
      evidence: years.map((item) => item.year + '：流年命宫' + item.palace.name + ' · ' + item.changes.map((c) => c.star + '化' + c.type + '在' + c.palace).join('、')).join(' / ')
    });
  }

  function monthlyCard(chart, timing) {
    const monthly = timing.focus.monthly;
    const palace = byIndex(chart, monthly.index);
    const changes = scopeChanges(chart, monthly);
    const key = changes.find((c) => c.type === '忌') || changes[0];
    const meta = lib.palaceMeta[palace.name];
    return card({
      id: 'monthly',
      group: '运限',
      title: '本月节律',
      verdict: '本月流月命宫落本命' + palace.name + '，主题是' + meta.theme + '。',
      paragraphs: [
        '流月看的是短期的注意力落在哪里。本月流月命宫在本命' + palace.name + '。这个月更容易被提起的是' + meta.theme + '。最值得留意的是：' + ask(meta.question),
        changes.length
          ? '流月四化：' + changes.map((c) => c.star + '化' + c.type + '入本命' + c.palace).join('、') + '。' +
            (key ? '其中' + key.star + '化' + key.type + '最值得留意：' + lib.transforms[key.type].byPalace[key.palace] : '')
          : '本月四化线索不强，按流年主线安排节奏即可。',
        '流月以农历月为界，换月前后可能有几天误差；只作节律参考，不当作具体日期的断语。'
      ],
      tags: uniq([palace.name, ...(key ? ['化' + key.type] : []), '短期']).slice(0, 4),
      evidence: '流月命宫：' + palace.name + ' · ' + changes.map((c) => c.star + '化' + c.type + '在' + c.palace).join('、')
    });
  }

  function adviceCard(chart, timing, patterns) {
    const self = readPalace(chart, '命宫');
    const work = readPalace(chart, '官禄');
    const love = readPalace(chart, '夫妻');
    const money = readPalace(chart, '财帛');
    const health = readPalace(chart, '疾厄');
    const star = self.star;
    const current = decadeFor(chart, timing.age);
    const year = yearData(chart, timing.year, timing.birthDate);
    const yearKey = year.changes.find((c) => c.type === '忌') || year.changes[0];
    const items = [
      ['先做的一件事', self.primary && STAR_ACTIONS[self.primary.name] ? STAR_ACTIONS[self.primary.name] : '选一件拖了很久的小事，今天做完第一步。'],
      ['关系里', love.entry ? firstSentence(love.entry[1]) + '先把它落到一条具体约定上，不要用试探代替提问。' : '把一件小事说具体：见面频率、忙时怎么联络、各自需要多少独处。'],
      ['钱与资源', money.star ? '你的财路偏' + money.star.keywords.join('、') + '；先留出六个月的备用金，再谈扩张。' : '先记清实际到手的钱，再谈怎么花。'],
      ['身体', health.info.localStars.some((s) => SHA.has(s.name)) ? '疾厄宫见' + health.info.localStars.filter((s) => SHA.has(s.name)).map(nameOf).join('、') + '，先把睡眠和恢复排进日程，不要等垮了才休息。' : '先把睡眠、吃饭、活动量中的一项固定下来，别同时改全部。'],
      ['今年', yearKey ? year.year + ' 年' + yearKey.star + '化' + yearKey.type + '入' + yearKey.palace + '，' + lib.transforms[yearKey.type].byPalace[yearKey.palace] : year.year + ' 年先把大限的主线做出来，不必另开新战场。']
    ];
    return card({
      id: 'advice',
      group: '收束',
      title: '给你的建议',
      verdict: '这张盘不缺道理，缺的是一次具体的实验。',
      paragraphs: [
        '不要一次改全部。选一件小事，做一周，再看反馈；有用的留下，没用的换掉。',
        (star ? '以你的' + (self.info.borrowed ? '借来的' : '') + star.alias + '底色，最值得练的不是“更努力”，而是“把力气用在对的地方”。' : '你的盘可塑性强，环境与选择比“天生如此”更重要。') +
          (patterns.length ? '盘面结构是' + patterns.slice(0, 2).map((p) => p.label).join('、') + '，顺着结构用力，比逆着来省力。' : '')
      ],
      items,
      tags: uniq([star?.keywords[0], current.name, String(timing.year), '可执行']).slice(0, 4),
      evidence: [self.evidence, work.evidence, '当前大限：' + current.name, '流年：' + year.year + ' ' + year.palace.name].join(' / ')
    });
  }

  function timingFor(chart, today, focusDate) {
    const birthDate = chart.solarDate.split('-').map((part, index) => index ? part.padStart(2, '0') : part).join('-');
    let date = focusDate && /^\d{4}-\d{2}-\d{2}$/.test(focusDate) ? focusDate : today;
    if (date < birthDate) date = today < birthDate ? birthDate : today;
    const focus = chart.horoscope(date, 6);
    const age = focus.age.nominalAge;
    const decade = decadeFor(chart, age);
    return { date, birthDate, focus, age, decade, year: Number(date.slice(0, 4)) };
  }

  return function createReading(chart, today, focusDate) {
    const timing = timingFor(chart, today, focusDate);
    const patterns = detectPatterns(chart);
    const cards = [];
    cards.push(overviewCard(chart, patterns));
    cards.push(characterCard(chart));
    cards.push(patternCard(chart, patterns));
    cards.push(fourChangesCard(chart));
    cards.push(...palaceCards(chart));
    cards.push(careerCard(chart, patterns, timing));
    cards.push(moneyCard(chart, timing));
    cards.push(loveCard(chart, timing));
    cards.push(familyCard(chart));
    cards.push(socialCard(chart));
    cards.push(healthCard(chart));
    cards.push(decadalCard(chart, timing));
    cards.push(yearlyCard(chart, timing, timing.birthDate));
    cards.push(monthlyCard(chart, timing));
    cards.push(adviceCard(chart, timing, patterns));
    return cards;
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { ziweiReading };
