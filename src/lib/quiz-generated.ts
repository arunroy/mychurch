// Questions the app makes itself, so a quiz round never runs dry when leaders have not written enough.
// Two sources: a hand-checked set of questions (each with the passage it comes from), and templates
// that build questions from the book list and the book guide. Everything here is pure and offline.

import { BIBLE_BOOKS } from './bible-books';
import { BOOK_GUIDE } from './book-guide';
import type { QuizLevel } from './database.types';

export type RoundQuestion = {
  question: string;
  options: string[];
  /** Position of the right choice in options, counting from 0. */
  correctIndex: number;
  explanation: string;
  reference: string;
};

type Random = () => number;

export function shuffle<T>(list: readonly T[], random: Random): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Puts the right answer among the wrong ones in a random place. */
function make(
  question: string,
  correct: string,
  wrong: readonly string[],
  explanation: string,
  reference: string,
  random: Random,
): RoundQuestion {
  const options = shuffle([correct, ...wrong], random);
  return { question, options, correctIndex: options.indexOf(correct), explanation, reference };
}

// ---------------------------------------------------------------------------
// Hand-checked questions
// ---------------------------------------------------------------------------

type Fixed = {
  level: QuizLevel;
  question: string;
  correct: string;
  wrong: [string, string, string];
  explanation: string;
  reference: string;
};

const f = (
  level: QuizLevel,
  question: string,
  correct: string,
  wrong: [string, string, string],
  explanation: string,
  reference: string,
): Fixed => ({ level, question, correct, wrong, explanation, reference });

const FIXED: Fixed[] = [
  // Little kids: the best-known stories and facts.
  f('little', 'Which is the first book of the Bible?', 'Genesis', ['Exodus', 'Psalms', 'Matthew'], 'The Bible begins with Genesis: "In the beginning, God created the heavens and the earth."', 'Genesis 1:1'),
  f('little', 'Who built the ark?', 'Noah', ['Moses', 'David', 'Daniel'], 'God told Noah to build an ark to save his family and the animals.', 'Genesis 6:14'),
  f('little', 'Who was the first man God made?', 'Adam', ['Noah', 'Abraham', 'Joseph'], 'God formed Adam from the dust of the ground.', 'Genesis 2:7'),
  f('little', 'Who was swallowed by a great fish?', 'Jonah', ['Daniel', 'Peter', 'Noah'], 'God sent a great fish to swallow Jonah, and Jonah prayed inside it.', 'Jonah 1:17'),
  f('little', 'Who was put in the lions\' den?', 'Daniel', ['Jonah', 'David', 'Joseph'], 'God shut the lions\' mouths and kept Daniel safe.', 'Daniel 6:16-22'),
  f('little', 'Who defeated the giant Goliath with a sling and a stone?', 'David', ['Moses', 'Samson', 'Noah'], 'David trusted God and defeated Goliath.', '1 Samuel 17:48-50'),
  f('little', 'In which town was Jesus born?', 'Bethlehem', ['Jerusalem', 'Nazareth', 'Jericho'], 'Jesus was born in Bethlehem, and laid in a manger.', 'Luke 2:4-7'),
  f('little', 'Who was the mother of Jesus?', 'Mary', ['Martha', 'Ruth', 'Esther'], 'The angel told Mary she would have a son and name him Jesus.', 'Luke 1:30-31'),
  f('little', 'How many disciples did Jesus choose to be with him?', 'Twelve', ['Three', 'Seven', 'Forty'], 'Jesus chose twelve men to be his closest followers.', 'Mark 3:14'),
  f('little', 'What did the boy share so Jesus could feed 5,000 people?', 'Five loaves and two fish', ['Ten apples', 'A bucket of water', 'Three honey cakes'], 'Jesus gave thanks and fed the crowd, with food left over.', 'John 6:9-13'),
  f('little', 'Who led God\'s people out of Egypt?', 'Moses', ['Noah', 'Joshua', 'Daniel'], 'God called Moses from a burning bush to lead his people out of Egypt.', 'Exodus 3:10'),
  f('little', 'Which book of the Bible says "The Lord is my shepherd"?', 'Psalms', ['Genesis', 'Matthew', 'Acts'], 'Psalm 23 begins "The Lord is my shepherd; I shall not want."', 'Psalm 23:1'),

  // Kids
  f('kids', 'Who was sold by his brothers and later became a leader in Egypt?', 'Joseph', ['Benjamin', 'Moses', 'Jacob'], 'God was with Joseph, and he saved many people from famine.', 'Genesis 37:28'),
  f('kids', 'How many plagues did God send on Egypt?', 'Ten', ['Three', 'Seven', 'Twelve'], 'God sent ten plagues before Pharaoh let his people go.', 'Exodus 7-12'),
  f('kids', 'Who received the Ten Commandments on Mount Sinai?', 'Moses', ['Aaron', 'Joshua', 'Elijah'], 'God gave Moses the commandments on tablets of stone.', 'Exodus 31:18'),
  f('kids', 'Shadrach, Meshach and who were thrown into the fiery furnace?', 'Abednego', ['Daniel', 'Nebuchadnezzar', 'Obadiah'], 'God was with them in the fire and they were not burned.', 'Daniel 3:19-27'),
  f('kids', 'Which wise king asked God for wisdom?', 'Solomon', ['Saul', 'Herod', 'Ahab'], 'Solomon asked for an understanding heart and God was pleased.', '1 Kings 3:9-12'),
  f('kids', 'Which brave queen saved her people?', 'Esther', ['Ruth', 'Mary', 'Sarah'], 'Esther risked her life to speak up for her people.', 'Esther 4:14-16'),
  f('kids', 'Who walked on the water towards Jesus?', 'Peter', ['John', 'Andrew', 'Judas'], 'Peter stepped out of the boat, but began to sink when he looked at the waves.', 'Matthew 14:28-29'),
  f('kids', 'Who climbed a sycamore tree to see Jesus?', 'Zacchaeus', ['Matthew', 'Nicodemus', 'Bartimaeus'], 'Jesus saw Zacchaeus and went to his house.', 'Luke 19:3-5'),
  f('kids', 'What did Jesus turn water into at the wedding in Cana?', 'Wine', ['Milk', 'Honey', 'Oil'], 'This was the first sign Jesus did.', 'John 2:9-11'),
  f('kids', 'Who baptized Jesus in the Jordan River?', 'John the Baptist', ['Peter', 'Paul', 'Andrew'], 'The Spirit came down on Jesus like a dove.', 'Matthew 3:13-16'),
  f('kids', 'On which day after he died did Jesus rise from the dead?', 'The third day', ['The first day', 'The seventh day', 'The fortieth day'], 'Jesus rose on the third day, just as he said.', 'Luke 24:7'),
  f('kids', 'How many books are in the Bible?', '66', ['39', '27', '100'], 'There are 39 books in the Old Testament and 27 in the New Testament.', ''),

  // Youth
  f('youth', 'Which book says "For God so loved the world that he gave his only Son"?', 'John', ['Romans', 'Luke', 'Acts'], 'John 3:16 sums up the good news.', 'John 3:16'),
  f('youth', 'Who met the risen Jesus on the road to Damascus?', 'Saul (Paul)', ['Peter', 'Stephen', 'Barnabas'], 'Saul became Paul, the apostle to the Gentiles.', 'Acts 9:3-6'),
  f('youth', 'Who was the first Christian martyr?', 'Stephen', ['James', 'Peter', 'Philip'], 'Stephen was stoned for preaching Jesus, and prayed for those who killed him.', 'Acts 7:59-60'),
  f('youth', 'Which book tells the story of the early church after Jesus went up to heaven?', 'Acts', ['Romans', 'Hebrews', 'Revelation'], 'Acts follows the apostles as the gospel spreads from Jerusalem to the world.', 'Acts 1:8'),
  f('youth', 'In which Gospel does Jesus say "I am the bread of life"?', 'John', ['Matthew', 'Mark', 'Luke'], 'The "I am" sayings are found in John\'s Gospel.', 'John 6:35'),
  f('youth', 'Which Gospel ends with Jesus saying "go and make disciples of all nations"?', 'Matthew', ['Mark', 'Luke', 'John'], 'This is called the Great Commission.', 'Matthew 28:19-20'),
  f('youth', 'Which is the first of the fruit of the Spirit listed in Galatians?', 'Love', ['Joy', 'Peace', 'Patience'], 'The fruit of the Spirit begins with love.', 'Galatians 5:22-23'),
  f('youth', 'Which apostle wrote the letter to the Romans?', 'Paul', ['Peter', 'John', 'James'], 'Paul wrote Romans, explaining how we are made right with God by faith.', 'Romans 1:1'),
  f('youth', 'Which Bible character was Paul\'s young helper, who received two letters from him?', 'Timothy', ['Titus', 'Silas', 'Mark'], 'Paul wrote two letters to Timothy to encourage him.', '2 Timothy 1:2'),
  f('youth', 'The Sermon on the Mount begins with the Beatitudes. In which Gospel is it found?', 'Matthew', ['John', 'Mark', 'Acts'], 'Matthew chapters 5 to 7 record the Sermon on the Mount.', 'Matthew 5:1-3'),
];

// ---------------------------------------------------------------------------
// Templates built from the book list
// ---------------------------------------------------------------------------

/** Books children know well, so younger rounds ask about the familiar ones. */
const FAMILIAR = [
  'Genesis', 'Exodus', 'Joshua', 'Ruth', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Isaiah', 'Daniel', 'Jonah',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', 'Philippians', 'Revelation',
];

const OLD_TESTAMENT_BOOKS = 39;

const bookNames = BIBLE_BOOKS.map((b) => b.name);

function pick<T>(list: readonly T[], random: Random): T {
  return list[Math.floor(random() * list.length)];
}

function otherBooks(exclude: string[], pool: readonly string[], count: number, random: Random) {
  return shuffle(pool.filter((name) => !exclude.includes(name)), random).slice(0, count);
}

function testamentQuestion(pool: readonly string[], random: Random): RoundQuestion {
  const name = pick(pool, random);
  const isOld = bookNames.indexOf(name) < OLD_TESTAMENT_BOOKS;
  return make(
    `Is ${name} in the Old Testament or the New Testament?`,
    isOld ? 'Old Testament' : 'New Testament',
    [isOld ? 'New Testament' : 'Old Testament'],
    `${name} is in the ${isOld ? 'Old' : 'New'} Testament.`,
    '',
    random,
  );
}

function nextBookQuestion(pool: readonly string[], random: Random): RoundQuestion {
  // The next book must be in the same testament so the question has one clear answer.
  const candidates = pool.filter((name) => {
    const i = bookNames.indexOf(name);
    return i !== OLD_TESTAMENT_BOOKS - 1 && i < bookNames.length - 1;
  });
  const name = pick(candidates, random);
  const next = bookNames[bookNames.indexOf(name) + 1];
  return make(
    `Which book comes right after ${name}?`,
    next,
    otherBooks([name, next], bookNames, 3, random),
    `${next} follows ${name} in the Bible.`,
    '',
    random,
  );
}

function chapterCountQuestion(pool: readonly string[], random: Random): RoundQuestion {
  const name = pick(pool, random);
  const count = BIBLE_BOOKS[bookNames.indexOf(name)].verses.length;
  const wrong = new Set<number>();
  for (const offset of shuffle([-10, -5, -3, -2, -1, 1, 2, 3, 5, 10], random)) {
    const n = count + offset;
    if (n >= 1 && wrong.size < 3) wrong.add(n);
  }
  return make(
    `How many chapters does ${name} have?`,
    String(count),
    [...wrong].map(String),
    `${name} has ${count} ${count === 1 ? 'chapter' : 'chapters'}.`,
    '',
    random,
  );
}

const GROUP_LABEL: Record<string, string> = {
  'The Law': 'The Law (the first five books)',
  History: 'History',
  'Poetry and wisdom': 'Poetry and wisdom',
  'The Prophets': 'The Prophets',
  'Gospels and Acts': 'The Gospels and Acts',
  Letters: 'The Letters',
  Revelation: 'Revelation',
};

function groupQuestion(pool: readonly string[], random: Random): RoundQuestion {
  const entries = BOOK_GUIDE.filter((b) => pool.includes(b.book));
  const entry = pick(entries, random);
  const wrong = shuffle(
    Object.keys(GROUP_LABEL).filter((g) => g !== entry.group && g !== 'Revelation'),
    random,
  ).slice(0, 3);
  return make(
    `Which part of the Bible is ${entry.book} in?`,
    GROUP_LABEL[entry.group],
    wrong.map((g) => GROUP_LABEL[g]),
    `${entry.book} is in ${GROUP_LABEL[entry.group]}.`,
    '',
    random,
  );
}

/** Authors the guide names plainly, so the answer is not a matter of debate. */
const CLEAR_AUTHORS = ['Paul', 'Luke', 'Peter', 'Isaiah', 'Jeremiah', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Micah'];

function authorQuestion(random: Random): RoundQuestion {
  const entry = pick(BOOK_GUIDE.filter((b) => CLEAR_AUTHORS.includes(b.author)), random);
  return make(
    `Who wrote the book of ${entry.book}?`,
    entry.author,
    shuffle(CLEAR_AUTHORS.filter((a) => a !== entry.author), random).slice(0, 3),
    `${entry.book} was written by ${entry.author}.`,
    '',
    random,
  );
}

function generate(level: QuizLevel, random: Random): RoundQuestion {
  if (level === 'little') {
    return random() < 0.5 ? testamentQuestion(FAMILIAR, random) : nextBookQuestion(['Genesis', 'Matthew', 'Mark', 'Luke', 'Joshua'], random);
  }
  if (level === 'kids') {
    const roll = random();
    if (roll < 0.35) return testamentQuestion(FAMILIAR, random);
    if (roll < 0.7) return nextBookQuestion(FAMILIAR, random);
    return chapterCountQuestion(['Genesis', 'Psalms', 'Proverbs', 'Isaiah', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Revelation'], random);
  }
  const roll = random();
  if (roll < 0.25) return nextBookQuestion(bookNames, random);
  if (roll < 0.5) return chapterCountQuestion(bookNames, random);
  if (roll < 0.75) return groupQuestion(bookNames.filter((n) => n !== 'Revelation'), random);
  return authorQuestion(random);
}

/**
 * Up to `count` distinct questions for a level: about half hand-checked ones and the rest from templates,
 * so rounds differ a lot from play to play. Leftover hand-checked ones fill any gap.
 */
export function generatedQuestions(level: QuizLevel, count: number, random: Random = Math.random): RoundQuestion[] {
  const fixed = shuffle(FIXED.filter((q) => q.level === level), random).map((q) =>
    make(q.question, q.correct, q.wrong, q.explanation, q.reference, random),
  );
  const result = fixed.slice(0, Math.ceil(count / 2));
  const seen = new Set(result.map((q) => q.question));
  // Templates can repeat themselves, so allow a few attempts per slot instead of looping forever.
  for (let attempts = 0; result.length < count && attempts < count * 20; attempts++) {
    const q = generate(level, random);
    if (!seen.has(q.question)) {
      seen.add(q.question);
      result.push(q);
    }
  }
  for (const q of fixed.slice(Math.ceil(count / 2))) {
    if (result.length >= count) break;
    if (!seen.has(q.question)) result.push(q);
  }
  return result;
}
