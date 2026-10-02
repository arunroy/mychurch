// A short guide to every book of the Bible, and a closer one to Paul's letters. Authors and dates
// are the traditional ones; where scholars differ or the author is not named, it says so. Book
// names match bible-books.ts exactly. Key verses are references only; the text is fetched.

import type { Reference } from './study-references';

export type BookGroup = 'The Law' | 'History' | 'Poetry and wisdom' | 'The Prophets' | 'Gospels and Acts' | 'Letters' | 'Revelation';

export const BOOK_GROUPS: BookGroup[] = [
  'The Law',
  'History',
  'Poetry and wisdom',
  'The Prophets',
  'Gospels and Acts',
  'Letters',
  'Revelation',
];

export type BookEntry = {
  book: string;
  group: BookGroup;
  author: string;
  theme: string;
  keyVerse: Reference;
};

const key = (note: string, book: string, chapter: number, verseStart: number, verseEnd = verseStart): Reference => ({
  note,
  book,
  chapter,
  verseStart,
  verseEnd,
});

const entry = (
  book: string,
  group: BookGroup,
  author: string,
  theme: string,
  chapter: number,
  verseStart: number,
  verseEnd = verseStart,
): BookEntry => ({ book, group, author, theme, keyVerse: key('Key verse', book, chapter, verseStart, verseEnd) });

const MOSES = 'Moses (traditionally)';
const UNKNOWN = 'Not named';

export const BOOK_GUIDE: BookEntry[] = [
  entry('Genesis', 'The Law', MOSES, 'Beginnings: creation, the fall, and God\'s promise to Abraham\'s family.', 12, 2, 3),
  entry('Exodus', 'The Law', MOSES, 'God rescues Israel from Egypt and gives the law at Sinai.', 20, 2),
  entry('Leviticus', 'The Law', MOSES, 'How a holy God lives among his people: sacrifice and holiness.', 19, 2),
  entry('Numbers', 'The Law', MOSES, 'Israel\'s years in the wilderness: unbelief, and God\'s faithfulness.', 6, 24, 26),
  entry('Deuteronomy', 'The Law', MOSES, 'Moses\' farewell: love the Lord and obey him.', 6, 4, 5),

  entry('Joshua', 'History', 'Joshua (traditionally)', 'Israel enters and settles the promised land.', 1, 9),
  entry('Judges', 'History', UNKNOWN, 'A cycle of sin and rescue before Israel had a king.', 21, 25),
  entry('Ruth', 'History', UNKNOWN, 'Loyalty and redemption: a foreigner joins the line of David.', 1, 16),
  entry('1 Samuel', 'History', UNKNOWN, 'Samuel, Israel\'s first king Saul, and the rise of David.', 16, 7),
  entry('2 Samuel', 'History', UNKNOWN, 'David\'s reign, and God\'s promise of a lasting throne.', 7, 16),
  entry('1 Kings', 'History', UNKNOWN, 'Solomon builds the temple; the kingdom divides.', 8, 56),
  entry('2 Kings', 'History', UNKNOWN, 'The kingdoms decline and go into exile.', 17, 7),
  entry('1 Chronicles', 'History', UNKNOWN, 'Israel\'s family line, David, and the place of worship.', 16, 34),
  entry('2 Chronicles', 'History', UNKNOWN, 'From Solomon to the exile, and a hopeful return.', 7, 14),
  entry('Ezra', 'History', 'Ezra (traditionally)', 'The exiles return and rebuild the temple.', 7, 10),
  entry('Nehemiah', 'History', 'Nehemiah (traditionally)', 'Rebuilding Jerusalem\'s walls and renewing the people.', 8, 10),
  entry('Esther', 'History', UNKNOWN, 'God\'s hidden care for his people in a foreign land.', 4, 14),

  entry('Job', 'Poetry and wisdom', UNKNOWN, 'Suffering, and trusting God when you do not understand.', 19, 25),
  entry('Psalms', 'Poetry and wisdom', 'David and others', 'Israel\'s prayers and songs: praise, lament, trust.', 23, 1),
  entry('Proverbs', 'Poetry and wisdom', 'Solomon and others', 'Wisdom for everyday life.', 9, 10),
  entry('Ecclesiastes', 'Poetry and wisdom', 'The Teacher (traditionally Solomon)', 'Life without God is empty; fear God and keep his commands.', 12, 13),
  entry('Song of Solomon', 'Poetry and wisdom', 'Solomon (traditionally)', 'A celebration of love in marriage.', 8, 6),

  entry('Isaiah', 'The Prophets', 'Isaiah', 'Judgment and comfort, and the coming Servant who suffers for his people.', 53, 5),
  entry('Jeremiah', 'The Prophets', 'Jeremiah', 'A warning of exile, and a promise of a new covenant.', 31, 33),
  entry('Lamentations', 'The Prophets', 'Jeremiah (traditionally)', 'Grief over Jerusalem\'s fall, and hope in God\'s mercy.', 3, 22, 23),
  entry('Ezekiel', 'The Prophets', 'Ezekiel', 'God\'s glory, judgment, and the promise of a new heart.', 36, 26),
  entry('Daniel', 'The Prophets', 'Daniel', 'Faithfulness in exile; God rules over every kingdom.', 3, 17, 18),
  entry('Hosea', 'The Prophets', 'Hosea', 'God\'s faithful love for an unfaithful people.', 6, 6),
  entry('Joel', 'The Prophets', 'Joel', 'The day of the Lord, and the Spirit poured out.', 2, 28),
  entry('Amos', 'The Prophets', 'Amos', 'A call for justice and true worship.', 5, 24),
  entry('Obadiah', 'The Prophets', 'Obadiah', 'Pride is judged; the Lord\'s kingdom will come.', 1, 15),
  entry('Jonah', 'The Prophets', 'Jonah (traditionally)', 'God\'s mercy reaches even Israel\'s enemies.', 4, 2),
  entry('Micah', 'The Prophets', 'Micah', 'Justice and mercy, and a ruler from Bethlehem.', 6, 8),
  entry('Nahum', 'The Prophets', 'Nahum', 'Nineveh falls; God is a refuge for those who trust him.', 1, 7),
  entry('Habakkuk', 'The Prophets', 'Habakkuk', 'Honest questions for God, answered with faith.', 2, 4),
  entry('Zephaniah', 'The Prophets', 'Zephaniah', 'Judgment on the day of the Lord, and God rejoicing over his people.', 3, 17),
  entry('Haggai', 'The Prophets', 'Haggai', 'Put God first: finish rebuilding the temple.', 1, 7, 8),
  entry('Zechariah', 'The Prophets', 'Zechariah', 'Encouragement for the returned exiles, and the coming king.', 4, 6),
  entry('Malachi', 'The Prophets', 'Malachi', 'A call to return to the Lord, who does not change.', 3, 6),

  entry('Matthew', 'Gospels and Acts', 'Matthew (traditionally)', 'Jesus is the promised King and Messiah.', 16, 16),
  entry('Mark', 'Gospels and Acts', 'Mark (traditionally)', 'Jesus the Servant who gives his life as a ransom.', 10, 45),
  entry('Luke', 'Gospels and Acts', 'Luke', 'Jesus came to seek and save the lost.', 19, 10),
  entry('John', 'Gospels and Acts', 'John (traditionally)', 'Jesus is the Son of God; believe and have life.', 20, 31),
  entry('Acts', 'Gospels and Acts', 'Luke', 'The Spirit comes and the gospel spreads from Jerusalem to the world.', 1, 8),

  entry('Romans', 'Letters', 'Paul', 'The gospel: made right with God by faith, and a new life in the Spirit.', 1, 16, 17),
  entry('1 Corinthians', 'Letters', 'Paul', 'Unity, holiness and love in a divided church.', 13, 13),
  entry('2 Corinthians', 'Letters', 'Paul', 'Strength in weakness, and the ministry of reconciliation.', 12, 9),
  entry('Galatians', 'Letters', 'Paul', 'Freedom in Christ, not the law.', 5, 1),
  entry('Ephesians', 'Letters', 'Paul', 'Our riches in Christ, and one new people of God.', 2, 8, 9),
  entry('Philippians', 'Letters', 'Paul', 'Joy in Christ in every circumstance.', 1, 21),
  entry('Colossians', 'Letters', 'Paul', 'Christ is supreme over all things.', 2, 9, 10),
  entry('1 Thessalonians', 'Letters', 'Paul', 'Stand firm, and hope in Christ\'s return.', 4, 13, 14),
  entry('2 Thessalonians', 'Letters', 'Paul', 'Keep steady and keep working until Christ returns.', 2, 15),
  entry('1 Timothy', 'Letters', 'Paul', 'How to lead and live in the church.', 4, 12),
  entry('2 Timothy', 'Letters', 'Paul', 'Paul\'s last letter: hold on to the gospel and endure.', 4, 7, 8),
  entry('Titus', 'Letters', 'Paul', 'Good works that flow from grace; leaders for the church.', 2, 11, 12),
  entry('Philemon', 'Letters', 'Paul', 'Welcoming a runaway slave back as a brother.', 1, 15, 16),
  entry('Hebrews', 'Letters', 'Not named', 'Jesus is greater than every priest, sacrifice and covenant before him.', 12, 1, 2),
  entry('James', 'Letters', 'James (the brother of Jesus)', 'Faith that shows itself in action.', 2, 17),
  entry('1 Peter', 'Letters', 'Peter', 'Hope and holy living for believers who suffer.', 1, 3),
  entry('2 Peter', 'Letters', 'Peter', 'Grow in Christ and beware of false teachers.', 3, 18),
  entry('1 John', 'Letters', 'John (traditionally)', 'Assurance of eternal life: walk in light and love.', 5, 13),
  entry('2 John', 'Letters', 'John (traditionally)', 'Hold to the truth and walk in love.', 1, 6),
  entry('3 John', 'Letters', 'John (traditionally)', 'Welcome and support those who serve the truth.', 1, 4),
  entry('Jude', 'Letters', 'Jude (the brother of James)', 'Contend for the faith once delivered.', 1, 3),

  entry('Revelation', 'Revelation', 'John', 'Christ\'s victory and the new creation.', 1, 8),
];

export type PaulLetter = {
  book: string;
  to: string;
  writtenFrom: string;
  /** Approximate; scholars differ by a few years. */
  date: string;
  theme: string;
  keyVerse: Reference;
};

const letter = (
  book: string,
  to: string,
  writtenFrom: string,
  date: string,
  theme: string,
  chapter: number,
  verseStart: number,
  verseEnd = verseStart,
): PaulLetter => ({ book, to, writtenFrom, date, theme, keyVerse: key('Key verse', book, chapter, verseStart, verseEnd) });

export const PAUL_LETTERS: PaulLetter[] = [
  letter('Romans', 'Believers in Rome', 'Corinth', 'about AD 57', 'The gospel: all are sinners, made right by faith in Christ, and called to a new life in the Spirit.', 1, 16, 17),
  letter('1 Corinthians', 'The church in Corinth', 'Ephesus', 'about AD 55', 'Answers to a divided, struggling church: unity, holiness, love, and the resurrection.', 13, 13),
  letter('2 Corinthians', 'The church in Corinth', 'Macedonia', 'about AD 56', 'Paul defends his ministry: comfort in suffering, and God\'s strength in weakness.', 12, 9),
  letter('Galatians', 'The churches of Galatia', 'Uncertain', 'about AD 49-55', 'We are made right by faith in Christ, not by keeping the law; stand in that freedom.', 5, 1),
  letter('Ephesians', 'The church in Ephesus and nearby', 'Prison in Rome', 'about AD 60-62', 'The riches of life in Christ, one new people of God, and how to live it out.', 2, 8, 9),
  letter('Philippians', 'The church in Philippi', 'Prison in Rome', 'about AD 60-62', 'Joy in Christ whatever the circumstances; the humility of Jesus as our example.', 1, 21),
  letter('Colossians', 'The church in Colossae', 'Prison in Rome', 'about AD 60-62', 'Christ is supreme over everything, and believers are complete in him.', 2, 9, 10),
  letter('1 Thessalonians', 'The church in Thessalonica', 'Corinth', 'about AD 50-51', 'Encouragement for new believers: live to please God and hope in Christ\'s return.', 4, 13, 14),
  letter('2 Thessalonians', 'The church in Thessalonica', 'Corinth', 'about AD 51', 'Stand firm and keep working while you wait for Christ\'s return.', 2, 15),
  letter('1 Timothy', 'Timothy, in Ephesus', 'Macedonia', 'about AD 62-64', 'Guidance for church life: sound teaching, godly leaders, and living for God.', 4, 12),
  letter('2 Timothy', 'Timothy', 'Prison in Rome', 'about AD 64-67', 'Paul\'s last words: guard the gospel, endure hardship, and hold to Scripture.', 4, 7, 8),
  letter('Titus', 'Titus, on Crete', 'Uncertain', 'about AD 62-64', 'Appoint faithful elders; good works flow from the grace of God.', 2, 11, 12),
  letter('Philemon', 'Philemon, in Colossae', 'Prison in Rome', 'about AD 60-62', 'Forgive and welcome back Onesimus, a runaway slave, as a brother in Christ.', 1, 15, 16),
];
