// A short, hand-picked set of passages about Jesus Christ: who he is, what he did, what he
// promised and how to follow him. Only references live here; the text is fetched in the chosen
// translation, the same way the Bible reader does it. Books use the names in bible-books.ts.

export type Reference = {
  /** What the passage says in a few words, shown above the reference. */
  note: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
};

export type ReferenceSection = {
  title: string;
  summary: string;
  references: Reference[];
};

const ref = (note: string, book: string, chapter: number, verseStart: number, verseEnd = verseStart): Reference => ({
  note,
  book,
  chapter,
  verseStart,
  verseEnd,
});

export const CHRIST_SECTIONS: ReferenceSection[] = [
  {
    title: 'Who Jesus is',
    summary: 'The names and titles the Bible gives him.',
    references: [
      ref('The Word, who was God', 'John', 1, 1, 3),
      ref('The Word became flesh', 'John', 1, 14),
      ref('The Lamb of God', 'John', 1, 29),
      ref('Son of the living God', 'Matthew', 16, 15, 16),
      ref('"My Lord and my God"', 'John', 20, 28),
      ref('The image of the invisible God', 'Colossians', 1, 15, 17),
      ref('God with us', 'Matthew', 1, 23),
      ref('Wonderful Counselor, Prince of Peace', 'Isaiah', 9, 6),
      ref('King of kings and Lord of lords', 'Revelation', 19, 16),
    ],
  },
  {
    title: 'The "I am" sayings',
    summary: 'In his own words, from John\'s Gospel.',
    references: [
      ref('The bread of life', 'John', 6, 35),
      ref('The light of the world', 'John', 8, 12),
      ref('Before Abraham was born, I am', 'John', 8, 58),
      ref('The door', 'John', 10, 9),
      ref('The good shepherd', 'John', 10, 11),
      ref('The resurrection and the life', 'John', 11, 25, 26),
      ref('The way, the truth and the life', 'John', 14, 6),
      ref('The true vine', 'John', 15, 5),
    ],
  },
  {
    title: 'Promised in the Old Testament',
    summary: 'What was said about him long before he came.',
    references: [
      ref('The offspring who will crush the serpent', 'Genesis', 3, 15),
      ref('A prophet like Moses', 'Deuteronomy', 18, 15),
      ref('Pierced hands and feet', 'Psalms', 22, 16, 18),
      ref('Born in Bethlehem', 'Micah', 5, 2),
      ref('The king arrives on a donkey', 'Zechariah', 9, 9),
      ref('Wounded for our transgressions', 'Isaiah', 53, 4, 6),
      ref('Jesus explains how the Scriptures speak of him', 'Luke', 24, 25, 27),
    ],
  },
  {
    title: 'What Christ did',
    summary: 'His birth, death, resurrection and return.',
    references: [
      ref('A Savior is born', 'Luke', 2, 10, 11),
      ref('A ransom for many', 'Mark', 10, 45),
      ref('Christ died for us while we were sinners', 'Romans', 5, 8),
      ref('Died, buried and raised on the third day', '1 Corinthians', 15, 3, 4),
      ref('He ascended into heaven', 'Acts', 1, 9, 11),
      ref('He always lives to intercede for us', 'Hebrews', 7, 25),
      ref('He will come again', 'John', 14, 1, 3),
    ],
  },
  {
    title: 'The good news',
    summary: 'How a person is made right with God through Christ.',
    references: [
      ref('God so loved the world', 'John', 3, 16),
      ref('The wages of sin and the gift of God', 'Romans', 6, 23),
      ref('Saved by grace through faith', 'Ephesians', 2, 8, 9),
      ref('Confess Jesus as Lord and believe', 'Romans', 10, 9),
      ref('No other name by which we must be saved', 'Acts', 4, 12),
      ref('If we confess our sins, he forgives', '1 John', 1, 9),
    ],
  },
  {
    title: 'His promises and invitations',
    summary: 'What Jesus says to people who come to him.',
    references: [
      ref('Come to me, all who are weary', 'Matthew', 11, 28, 30),
      ref('My peace I give you', 'John', 14, 27),
      ref('My sheep hear my voice', 'John', 10, 27, 28),
      ref('I stand at the door and knock', 'Revelation', 3, 20),
      ref('I am with you always', 'Matthew', 28, 20),
    ],
  },
  {
    title: 'Following Christ',
    summary: 'What it looks like to live as his disciple.',
    references: [
      ref('Take up your cross daily', 'Luke', 9, 23),
      ref('Love one another as I have loved you', 'John', 13, 34, 35),
      ref('Christ lives in me', 'Galatians', 2, 20),
      ref('The mind of Christ: humble and obedient', 'Philippians', 2, 5, 8),
      ref('Go and make disciples', 'Matthew', 28, 19, 20),
    ],
  },
];

export const DOCTRINE_SECTIONS: ReferenceSection[] = [
  {
    title: 'The Scriptures',
    summary: 'God speaking, and why we trust and read his word.',
    references: [
      ref('All Scripture is God-breathed', '2 Timothy', 3, 16, 17),
      ref('Prophets spoke as the Spirit moved them', '2 Peter', 1, 20, 21),
      ref('The word is living and active', 'Hebrews', 4, 12),
      ref('A lamp for my feet', 'Psalms', 119, 105),
    ],
  },
  {
    title: 'God: Father, Son and Spirit',
    summary: 'One God, known in three persons.',
    references: [
      ref('Baptize in the name of the Father, Son and Holy Spirit', 'Matthew', 28, 19),
      ref("At Jesus' baptism the three are present", 'Matthew', 3, 16, 17),
      ref('The grace of the Lord Jesus, love of God, fellowship of the Spirit', '2 Corinthians', 13, 14),
      ref('Hear, O Israel: the Lord is one', 'Deuteronomy', 6, 4),
    ],
  },
  {
    title: 'Sin and our need',
    summary: 'Why people need a Savior.',
    references: [
      ref('All have sinned', 'Romans', 3, 23),
      ref('Sin separates us from God', 'Isaiah', 59, 2),
      ref('Through one man sin entered the world', 'Romans', 5, 12),
      ref('The wages of sin is death', 'Romans', 6, 23),
    ],
  },
  {
    title: 'Salvation by grace',
    summary: 'Made right with God as a gift, received by faith.',
    references: [
      ref('Saved by grace through faith', 'Ephesians', 2, 8, 9),
      ref('Justified freely by his grace', 'Romans', 3, 23, 24),
      ref('Peace with God through faith', 'Romans', 5, 1),
      ref('Justified by faith, not works of the law', 'Galatians', 2, 16),
      ref('He saved us because of his mercy', 'Titus', 3, 4, 7),
      ref('No condemnation for those in Christ', 'Romans', 8, 1),
    ],
  },
  {
    title: 'The Holy Spirit',
    summary: 'Who he is and what he does in believers.',
    references: [
      ref('The Helper will teach you all things', 'John', 14, 26),
      ref('The Spirit of truth will guide you', 'John', 16, 13),
      ref('You will receive power when the Spirit comes', 'Acts', 1, 8),
      ref('The Spirit helps us in our weakness', 'Romans', 8, 26, 27),
      ref('The fruit of the Spirit', 'Galatians', 5, 22, 23),
      ref('Gifts for the common good', '1 Corinthians', 12, 4, 7),
    ],
  },
  {
    title: 'New life and growth',
    summary: 'Becoming more like Christ.',
    references: [
      ref('A new creation', '2 Corinthians', 5, 17),
      ref('Be transformed by the renewing of your mind', 'Romans', 12, 1, 2),
      ref('He who began a good work will finish it', 'Philippians', 1, 6),
      ref('Grow in grace and knowledge', '2 Peter', 3, 18),
    ],
  },
  {
    title: 'The church',
    summary: "God's people, together.",
    references: [
      ref('I will build my church', 'Matthew', 16, 18),
      ref('Devoted to teaching, fellowship, bread and prayer', 'Acts', 2, 42),
      ref('One body, many parts', '1 Corinthians', 12, 12, 14),
      ref('You are the body of Christ', '1 Corinthians', 12, 27),
      ref('Do not give up meeting together', 'Hebrews', 10, 24, 25),
    ],
  },
  {
    title: "Baptism and the Lord's Supper",
    summary: 'The two practices Christ gave his church.',
    references: [
      ref('Repent and be baptized', 'Acts', 2, 38),
      ref('Buried with him in baptism, raised to new life', 'Romans', 6, 3, 4),
      ref('Raised with him through faith', 'Colossians', 2, 12),
      ref('"This is my body... this is my blood"', 'Luke', 22, 19, 20),
      ref('Eat and drink in remembrance of him', '1 Corinthians', 11, 23, 26),
    ],
  },
  {
    title: 'Resurrection and the return of Christ',
    summary: 'Our hope for what is ahead.',
    references: [
      ref('Christ is the firstfruits of those who sleep', '1 Corinthians', 15, 20, 22),
      ref('The Spirit who raised Jesus will give life to us', 'Romans', 8, 11),
      ref('The Lord himself will come down from heaven', '1 Thessalonians', 4, 16, 17),
      ref('The blessed hope and appearing of our Savior', 'Titus', 2, 13),
      ref('No one knows the day or hour', 'Matthew', 24, 36),
    ],
  },
];

export const PROMISE_SECTIONS: ReferenceSection[] = [
  {
    title: 'When you are afraid',
    summary: 'God is with you.',
    references: [
      ref('Do not fear, I am with you', 'Isaiah', 41, 10),
      ref('Even in the valley of the shadow of death', 'Psalms', 23, 4),
      ref('Be strong and courageous', 'Joshua', 1, 9),
      ref('A spirit of power, love and self-control', '2 Timothy', 1, 7),
    ],
  },
  {
    title: 'When you are anxious',
    summary: 'Hand your worries to him.',
    references: [
      ref('Pray about everything and the peace of God will guard you', 'Philippians', 4, 6, 7),
      ref('Cast all your anxiety on him', '1 Peter', 5, 7),
      ref('Seek first his kingdom; do not worry about tomorrow', 'Matthew', 6, 31, 34),
    ],
  },
  {
    title: 'When you are grieving',
    summary: 'He is near to the brokenhearted.',
    references: [
      ref('The Lord is close to the brokenhearted', 'Psalms', 34, 18),
      ref('Blessed are those who mourn', 'Matthew', 5, 4),
      ref('The God of all comfort', '2 Corinthians', 1, 3, 4),
      ref('He will wipe away every tear', 'Revelation', 21, 4),
    ],
  },
  {
    title: 'When you have sinned',
    summary: 'Forgiveness and a fresh start.',
    references: [
      ref('If we confess, he is faithful to forgive', '1 John', 1, 9),
      ref('Create in me a clean heart', 'Psalms', 51, 10),
      ref('As far as the east is from the west', 'Psalms', 103, 12),
      ref('No condemnation for those in Christ', 'Romans', 8, 1),
    ],
  },
  {
    title: 'When you are tempted',
    summary: 'God provides a way through.',
    references: [
      ref('God is faithful and will provide a way out', '1 Corinthians', 10, 13),
      ref('Jesus understands; approach the throne with confidence', 'Hebrews', 4, 15, 16),
      ref('Submit to God, resist the devil', 'James', 4, 7),
    ],
  },
  {
    title: 'When you need guidance',
    summary: 'Ask, trust and listen.',
    references: [
      ref('Trust in the Lord with all your heart', 'Proverbs', 3, 5, 6),
      ref('I will instruct you and counsel you', 'Psalms', 32, 8),
      ref('If you lack wisdom, ask God', 'James', 1, 5),
    ],
  },
  {
    title: 'When you are weary',
    summary: 'Strength for the long road.',
    references: [
      ref('Those who hope in the Lord will renew their strength', 'Isaiah', 40, 30, 31),
      ref('Do not grow weary in doing good', 'Galatians', 6, 9),
      ref('Our light and momentary troubles', '2 Corinthians', 4, 16, 17),
    ],
  },
  {
    title: 'When you are suffering',
    summary: 'God works even in pain.',
    references: [
      ref('All things work together for good', 'Romans', 8, 28),
      ref('My grace is sufficient for you', '2 Corinthians', 12, 9),
      ref('Present sufferings are not worth comparing to the glory', 'Romans', 8, 18),
      ref('Call the elders to pray over the sick', 'James', 5, 14, 15),
    ],
  },
  {
    title: 'When you are thankful',
    summary: 'Give thanks in all things.',
    references: [
      ref('Give thanks in all circumstances', '1 Thessalonians', 5, 16, 18),
      ref('Enter his gates with thanksgiving', 'Psalms', 100, 4, 5),
      ref('My God will meet all your needs', 'Philippians', 4, 19),
    ],
  },
];
