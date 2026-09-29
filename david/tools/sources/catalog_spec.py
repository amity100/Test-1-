"""Specification of every quotation the game shows (or is recommended to show), plus the
research references used for art direction.  build_catalog.py turns this into
src/content/sources.ts (display catalog, shipped with the game) and
src/content/sourcesReference.ts (research catalog, never imported by the game).

Each entry:
  id      stable id (becomes the key in the TS catalog)
  src     ('I Samuel', ch, v) | ('I Samuel', ch, v1, v2)          Tanakh (MAM edition)
          ('Shemot Rabbah', ch, section)                          Midrash (Torat Emet)
          ('Yoma', daf, 'a'|'b', segment)                         Talmud (Koren/Davidson)
          ('Rashi on I Samuel', ch, v, segment) / ('Targum Jonathan on I Samuel', ch, v)
  q       list of quote pieces written as UNPOINTED skeletons (maqaf = space, ה׳ for the
          divine name). The builder replaces each with the exact pointed substring of the
          normalized source. Several pieces are shown joined by ' … '. None = no display quote.
  occ     optional occurrence number(s) when a piece occurs more than once (default 1)
  status  in-game | intro | ending | reference | avoid-in-intro | docs
  use     where it is used / recommendation
  gloss   short English gloss (translation aid only)
  note    ketiv/qere, chronology and context caveats
"""

E = dict

DISPLAY = [
    # ------------------------------------------------------------------ quotes currently in the game
    E(id='s1_17_12_ephrathite', src=('I Samuel', 17, 12),
      q=['ודוד בן איש אפרתי הזה מבית לחם יהודה ושמו ישי'],
      status='in-game', use='Story.ts intro t=11.2 ui.verse',
      gloss='Now David was the son of that Ephrathite of Bethlehem in Judah, whose name was Jesse.'),
    E(id='gen_35_19_rachel_buried', src=('Genesis', 35, 19),
      q=['ותקבר בדרך אפרתה הוא בית לחם'],
      status='in-game', use='Story.ts intro t=16.2 ui.caption sub (Rachel\'s tomb)',
      gloss='...and was buried on the way to Ephrath, which is Bethlehem.',
      note='בֵּית לָחֶם with qamats is the pausal form at the end of the verse - correct as printed.'),
    E(id='s1_16_11_youngest', src=('I Samuel', 16, 11),
      q=['עוד שאר הקטן והנה רעה בצאן'],
      status='in-game', use='Story.ts intro t=22.8 ui.verse',
      gloss='There remains yet the youngest, and behold, he is tending the sheep.',
      note='Spoken by Jesse to Samuel on the day of the anointing (16:11). Shown in the intro as a '
           'description of David; the reference makes the source clear.'),
    E(id='s1_16_12_ruddy', src=('I Samuel', 16, 12),
      q=['והוא אדמוני עם יפה עינים וטוב ראי'],
      status='in-game', use='Story.ts intro t=29.5 ui.verse',
      gloss='And he was ruddy, with beautiful eyes and good looks.'),
    E(id='shr_2_2_flock', src=('Shemot Rabbah', 2, 2),
      q=['בדק לדוד בצאן ומצאו רועה יפה',
         'היה מונע הגדולים מפני הקטנים והיה מוציא הקטנים לרעות כדי שירעו עשב הרך ואחר כך מוציא '
         'הזקנים כדי שירעו עשב הבינונית ואחר כך מוציא הבחורים שיהיו אוכלין עשב הקשה אמר הקדוש '
         'ברוך הוא מי שהוא יודע לרעות הצאן איש לפי כחו יבא וירעה בעמי'],
      status='in-game', use='Story.ts:226 ui.toast after calling the flock (replaces the paraphrase)',
      gloss='He tested David with the sheep and found him a good shepherd... He would hold back the '
            'big ones for the sake of the small ones; he brought out the small ones to graze so they '
            'would eat the soft grass, then the old ones to eat the middling grass, then the young '
            'strong ones to eat the hard grass. Said the Holy One, blessed be He: whoever knows how to '
            'shepherd the flock, each according to its strength, let him come and shepherd My people.',
      note='Vocalized text of the Torat Emet edition (as on Sefaria); consonantal text verified '
           'identical to the Daat edition (public domain). The midrash expounds Ps 78:70-71.'),
    E(id='shr_2_2_flock_short', src=('Shemot Rabbah', 2, 2),
      q=['והיה מוציא הקטנים לרעות כדי שירעו עשב הרך',
         'אמר הקדוש ברוך הוא מי שהוא יודע לרעות הצאן איש לפי כחו יבא וירעה בעמי'],
      status='in-game', use='Shorter alternative for the Story.ts:226 toast (mobile / small screens)',
      gloss='He brought out the small ones to graze so they would eat the soft grass... Said the Holy One, '
            'blessed be He: whoever knows how to shepherd the flock, each according to its strength, let him come and shepherd My people.'),
    E(id='s1_17_40_stones', src=('I Samuel', 17, 40),
      q=['ויבחר לו חמשה חלקי אבנים מן הנחל וישם אתם בכלי הרעים'],
      status='in-game', use='Story.ts:288 ui.verse after the five stones are gathered',
      gloss='...and chose for himself five smooth stones out of the brook, and put them in the '
            'shepherd\'s bag.',
      note='Describes the day of the battle with Goliath; the objective text already frames it as '
           'foreshadowing ("כפי שיעשה יום אחד בעמק האלה").'),
    E(id='jdg_20_16_slingers', src=('Judges', 20, 16),
      q=['כל זה קלע באבן אל השערה ולא יחטא'],
      status='in-game', use='Story.ts:304 ui.verse after the first jar breaks',
      gloss='...every one of these could sling a stone at a hair and not miss.',
      note='Describes the 700 left-handed picked men of Benjamin from Gibeah (20:15) - Saul\'s tribe '
           'and town. Accurate as a statement about Israelite slingers.'),
    E(id='s1_17_34_bear', src=('I Samuel', 17, 34),
      q=['ובא הארי ואת הדוב ונשא שה מהעדר'],
      status='in-game', use='Story.ts:568 ui.verse when the bear appears',
      gloss='...and there came a lion, and also a bear, and took a lamb out of the flock.'),
    E(id='s1_17_35_went_after', src=('I Samuel', 17, 35), q=['ויצאתי אחריו'],
      status='in-game', use='Story.ts:625 objective sub (quoted word)', gloss='And I went out after him'),
    E(id='s1_17_35_smote', src=('I Samuel', 17, 35), q=['והכתיו'],
      status='in-game', use='Story.ts:650 objective sub (quoted word)', gloss='and smote him'),
    E(id='s1_17_35_delivered', src=('I Samuel', 17, 35), q=['והצלתי מפיו'],
      status='in-game', use='Story.ts:697 objective sub (quoted words)', gloss='and delivered it out of his mouth'),
    E(id='s1_17_35_smote_delivered', src=('I Samuel', 17, 35), q=['והכתיו והצלתי מפיו'],
      status='in-game', use='Story.ts:760 ui.verse', gloss='and smote him, and delivered it out of his mouth'),
    E(id='s1_17_35_rose', src=('I Samuel', 17, 35), q=['ויקם עלי'],
      status='in-game', use='Story.ts:821 ui.verse', gloss='and when he arose against me'),
    E(id='s1_17_35_beard', src=('I Samuel', 17, 35), q=['והחזקתי בזקנו'],
      status='in-game', use='Story.ts:923 ui.verse', gloss='I caught him by his beard'),
    E(id='s1_17_35_slew', src=('I Samuel', 17, 35), q=['והכתיו והמיתיו'],
      status='in-game', use='Story.ts:994 ui.verse', gloss='and smote him, and slew him'),
    E(id='ps_23_1_shepherd', src=('Psalms', 23, 1), q=['ה׳ רעי לא אחסר'],
      status='in-game', use='Story.ts:880 ui.verse during the dodge phase',
      gloss='The LORD is my shepherd; I shall not want.'),
    E(id='ps_23_1_2_loading', src=('Psalms', 23, 1, 2), q=['ה׳ רעי לא אחסר בנאות דשא ירביצני'],
      status='in-game', use='UI.ts:55 loading screen quote (ref was "תהלים כג"; now "תְּהִלִּים כג, א–ב")',
      gloss='The LORD is my shepherd; I shall not want. He makes me lie down in green pastures.',
      note='Spans the end of v.1 and the start of v.2 (verses joined by a single space).'),
    E(id='s1_17_37_delivered_me', src=('I Samuel', 17, 37),
      q=['ה׳ אשר הצלני מיד הארי ומיד הדב הוא יצילני'],
      status='in-game', use='Story.ts:1086 ending ui.verse',
      gloss='The LORD who delivered me from the paw of the lion and from the paw of the bear, He will deliver me.'),
    E(id='ps_23_4_rod_staff', src=('Psalms', 23, 4),
      q=['גם כי אלך בגיא צלמות לא אירא רע כי אתה עמדי שבטך ומשענתך המה ינחמני'],
      status='in-game', use='Story.ts:1087 ending ui.verse',
      gloss='Even when I walk in the valley of deep darkness I fear no evil, for You are with me; '
            'Your rod and Your staff, they comfort me.'),
    E(id='s1_17_36_37_endcard', src=('I Samuel', 17, 36, 37),
      q=['גם את הארי גם הדב הכה עבדך',
         'ה׳ אשר הצלני מיד הארי ומיד הדב הוא יצילני מיד הפלשתי הזה'],
      status='in-game', use='UI.ts:327 end card',
      gloss='Your servant smote both the lion and the bear... The LORD who delivered me from the paw of '
            'the lion and from the paw of the bear, He will deliver me from the hand of this Philistine.',
      note='MAM (Aleppo) spells הַדֹּב in 17:36; the Leningrad codex (WLC) has הַדּוֹב. We follow MAM.'),
    E(id='s1_16_1_fill_horn', src=('I Samuel', 16, 1),
      q=['מלא קרנך שמן ולך אשלחך אל ישי בית הלחמי כי ראיתי בבניו לי מלך'],
      status='in-game', use='UI.ts:328 end card - next-chapter teaser',
      gloss='Fill your horn with oil and go; I will send you to Jesse the Bethlehemite, for I have '
            'provided Me a king among his sons.'),

    # ------------------------------------------------------------------ recommended for the new intro
    E(id='s1_15_34_gibeah_home', src=('I Samuel', 15, 34),
      q=['ושאול עלה אל ביתו גבעת שאול'],
      status='intro', use='Intro beat G1 - establishing shot of Gibeah of Saul',
      gloss='...and Saul went up to his house, to Gibeah of Saul.',
      note='The last verse about Saul before 16:1 - exactly the moment of the intro.'),
    E(id='s1_15_35_samuel_mourned', src=('I Samuel', 15, 35),
      q=['ולא יסף שמואל לראות את שאול עד יום מותו כי התאבל שמואל אל שאול'],
      status='intro', use='Intro beat G4 - Saul alone in his hall / Samuel\'s absence',
      gloss='And Samuel saw Saul no more until the day of his death, for Samuel mourned for Saul.'),
    E(id='s1_9_2_tallest', src=('I Samuel', 9, 2),
      q=['בחור וטוב ואין איש מבני ישראל טוב ממנו משכמו ומעלה גבה מכל העם'],
      status='intro', use='Intro beat G2 - first full view of Saul',
      gloss='...a choice young man and goodly; there was not among the children of Israel a goodlier '
            'person than he; from his shoulders and upward he was taller than any of the people.',
      note='Describes Saul when he was chosen (years earlier); the portrait still holds.'),
    E(id='s1_9_2_head_above', src=('I Samuel', 9, 2), q=['משכמו ומעלה גבה מכל העם'],
      status='intro', use='Short form of s1_9_2_tallest',
      gloss='from his shoulders and upward he was taller than any of the people'),
    E(id='s1_10_23_head_above', src=('I Samuel', 10, 23), q=['ויגבה מכל העם משכמו ומעלה'],
      status='intro', use='Alternative to s1_9_2_head_above',
      gloss='...and he was taller than any of the people from his shoulders and upward.'),
    E(id='s1_10_26_valiant_men', src=('I Samuel', 10, 26),
      q=['וגם שאול הלך לביתו גבעתה וילכו עמו החיל אשר נגע אלהים בלבם'],
      status='intro', use='Intro beat G1/G3 - Saul\'s men at Gibeah',
      gloss='And Saul also went to his house to Gibeah, and there went with him the band of men whose '
            'hearts God had touched.'),
    E(id='s1_22_6_tamarisk', src=('I Samuel', 22, 6),
      q=['ושאול יושב בגבעה תחת האשל ברמה וחניתו בידו וכל עבדיו נצבים עליו'],
      status='intro', use='Intro beat G3 - Saul holding court under the tamarisk, spear in hand',
      gloss='...and Saul was sitting in Gibeah under the tamarisk tree on the height, with his spear in '
            'his hand, and all his servants standing about him.',
      note='Chronology: this scene is from a later time (David already a fugitive). The quoted words '
           'omit the first clause about David and show only the portrait of Saul\'s court.'),
    E(id='s1_14_47_took_kingship', src=('I Samuel', 14, 47),
      q=['ושאול לכד המלוכה על ישראל וילחם סביב בכל איביו', 'ובכל אשר יפנה ירשיע'],
      status='intro', use='Intro beat G3 - Saul as a victorious warrior-king',
      gloss='So Saul took the kingdom over Israel and fought against all his enemies on every side... '
            'and wherever he turned, he vanquished them.'),
    E(id='s1_14_50_abner', src=('I Samuel', 14, 50), q=['ושם שר צבאו אבינר בן נר דוד שאול'],
      status='intro', use='Caption for Abner, commander of the army',
      gloss='...and the name of the captain of his host was Abner son of Ner, Saul\'s uncle.',
      note='The verse spells the name אֲבִינֵר; elsewhere אַבְנֵר.'),
    E(id='s1_14_52_mighty_men', src=('I Samuel', 14, 52),
      q=['ותהי המלחמה חזקה על פלשתים כל ימי שאול וראה שאול כל איש גבור וכל בן חיל ויאספהו אליו'],
      status='intro', use='Intro beat G3 - the warriors of the royal guard',
      gloss='And there was sore war against the Philistines all the days of Saul; and whenever Saul saw '
            'any mighty man or any valiant man, he took him unto him.'),
    E(id='s1_15_28_torn_kingdom', src=('I Samuel', 15, 28),
      q=['קרע ה׳ את ממלכות ישראל מעליך היום ונתנה לרעך הטוב ממך'],
      status='intro', use='Intro transition G4 -> Bethlehem (cut from Saul to David)',
      gloss='The LORD has torn the kingdom of Israel from you this day, and has given it to a neighbour '
            'of yours who is better than you.',
      note='Samuel to Saul at Gilgal (ch. 15), shortly before the intro. Safe to show.'),
    E(id='s1_13_14_after_his_heart', src=('I Samuel', 13, 14), q=['בקש ה׳ לו איש כלבבו'],
      status='intro', use='Alternative transition line (Saul -> David)',
      gloss='The LORD has sought for Himself a man after His own heart.'),
    E(id='s1_16_7_looks_heart', src=('I Samuel', 16, 7), q=['כי האדם יראה לעינים וה׳ יראה ללבב'],
      status='intro', use='Closing thought of the contrast (tall king / youngest shepherd)',
      gloss='For man looks on the outward appearance, but the LORD looks on the heart.',
      note='Said to Samuel about Eliab on the day of the anointing (16:7). Radak cites an opinion that '
           'it also answers Samuel\'s attachment to tall, handsome Saul. Show only with the reference; '
           'do not caption it as said about Saul.'),
    E(id='s1_15_17_small_in_eyes', src=('I Samuel', 15, 17),
      q=['הלוא אם קטן אתה בעיניך ראש שבטי ישראל אתה'],
      status='intro', use='Optional line for Saul\'s hall (Samuel\'s rebuke at Gilgal)',
      gloss='Though you are small in your own eyes, are you not head of the tribes of Israel?'),
    E(id='ps_78_70_71_chose_david', src=('Psalms', 78, 70, 71),
      q=['ויבחר בדוד עבדו ויקחהו ממכלאת צאן מאחר עלות הביאו לרעות ביעקב עמו ובישראל נחלתו'],
      status='intro', use='Intro final line before the title card (or ending)',
      gloss='He chose David His servant and took him from the sheepfolds; from following the nursing '
            'ewes He brought him to shepherd Jacob His people and Israel His inheritance.',
      note='These are exactly the verses Shemot Rabbah 2:2 expounds.'),
    E(id='ps_78_70_chose_david', src=('Psalms', 78, 70), q=['ויבחר בדוד עבדו ויקחהו ממכלאת צאן'],
      status='intro', use='Short form of ps_78_70_71_chose_david',
      gloss='He chose David His servant and took him from the sheepfolds.'),
    E(id='s2_1_23_eagles_lions', src=('II Samuel', 1, 23), q=['מנשרים קלו מאריות גברו'],
      status='intro', use='Optional: Saul and his warriors (David\'s later lament - use with the reference)',
      gloss='They were swifter than eagles, they were stronger than lions.',
      note='From David\'s lament over Saul and Jonathan (2 Sam 1). Proleptic; never caption it as a '
           'statement of this moment.'),

    # ------------------------------------------------------------------ recommended for the chapter end
    E(id='s2_7_8_from_pasture', src=('II Samuel', 7, 8),
      q=['אני לקחתיך מן הנוה מאחר הצאן להיות נגיד על עמי על ישראל'],
      status='ending', use='End card / epilogue line',
      gloss='I took you from the pasture, from following the sheep, to be prince over My people, over Israel.'),
]

REFERENCE = [
    # ------------------------------------------------------------------ Saul: person, family, court
    E(id='s1_9_1_kish', src=('I Samuel', 9, 1), q=None, status='reference',
      gloss='There was a man of Benjamin whose name was Kish... a mighty man of valour.',
      note='Ketiv מבן ימין, qere מִבִּנְיָמִין.'),
    E(id='s1_10_22_hiding', src=('I Samuel', 10, 22), q=['הנה הוא נחבא אל הכלים'], status='reference',
      gloss='Behold, he has hidden himself among the baggage.'),
    E(id='s1_10_24_long_live', src=('I Samuel', 10, 24),
      q=['הראיתם אשר בחר בו ה׳ כי אין כמהו בכל העם וירעו כל העם ויאמרו יחי המלך'], status='reference',
      gloss='Do you see him whom the LORD has chosen, that there is none like him among all the people? '
            'And all the people shouted and said: Long live the king!'),
    E(id='s1_10_27_no_gift', src=('I Samuel', 10, 27), q=None, status='reference',
      gloss='But certain base fellows said: How shall this man save us? They despised him and brought '
            'him no present; but he held his peace.'),
    E(id='s1_11_5_behind_oxen', src=('I Samuel', 11, 5), q=['והנה שאול בא אחרי הבקר מן השדה'],
      status='reference', gloss='And behold, Saul came following the oxen out of the field.',
      note='Even as king, Saul still worked his family\'s land at Gibeah (11:4-5).'),
    E(id='s1_13_2_three_thousand', src=('I Samuel', 13, 2), q=None, status='reference',
      gloss='Saul chose three thousand men of Israel: two thousand with Saul in Michmash and in the '
            'hill-country of Beth-el, and a thousand with Jonathan in Gibeah of Benjamin.'),
    E(id='s1_13_19_no_smith', src=('I Samuel', 13, 19), q=None, status='reference',
      gloss='Now there was no smith found throughout all the land of Israel, for the Philistines said: '
            'Lest the Hebrews make themselves swords or spears.',
      note='Ketiv אמר, qere אָמְרוּ.'),
    E(id='s1_13_22_no_swords', src=('I Samuel', 13, 22), q=None, status='reference',
      gloss='...neither sword nor spear was found in the hand of any of the people with Saul and '
            'Jonathan; but with Saul and with Jonathan his son was there found.'),
    E(id='s1_14_2_pomegranate', src=('I Samuel', 14, 2),
      q=['ושאול יושב בקצה הגבעה תחת הרמון אשר במגרון'], status='reference',
      gloss='And Saul was staying in the outskirts of Gibeah under the pomegranate tree in Migron.'),
    E(id='s1_14_48_valor', src=('I Samuel', 14, 48), q=None, status='reference',
      gloss='And he did valiantly, and smote the Amalekites, and delivered Israel out of the hands of '
            'them that spoiled them.'),
    E(id='s1_14_49_51_family', src=('I Samuel', 14, 49, 51), q=None, status='reference',
      gloss='Saul\'s sons Jonathan, Ishvi and Malchishua; daughters Merab (elder) and Michal (younger); '
            'wife Ahinoam daughter of Ahimaaz; Abner son of Ner, Saul\'s uncle; Kish father of Saul.'),
    E(id='s1_15_12_monument', src=('I Samuel', 15, 12), q=['והנה מציב לו יד'], status='reference',
      gloss='...behold, he set up a monument for himself.'),
    E(id='s1_15_22_obey', src=('I Samuel', 15, 22), q=['הנה שמע מזבח טוב להקשיב מחלב אילים'],
      status='reference', gloss='Behold, to obey is better than sacrifice, and to hearken than the fat of rams.'),
    E(id='s1_15_23_rejected', src=('I Samuel', 15, 23), q=['יען מאסת את דבר ה׳ וימאסך ממלך'],
      status='reference', gloss='Because you have rejected the word of the LORD, He has rejected you from being king.'),
    E(id='s1_15_26_rejected', src=('I Samuel', 15, 26), q=['וימאסך ה׳ מהיות מלך על ישראל'],
      status='reference', gloss='...and the LORD has rejected you from being king over Israel.'),
    E(id='s1_15_27_robe', src=('I Samuel', 15, 27), q=['ויחזק בכנף מעילו ויקרע'], status='reference',
      gloss='...he laid hold upon the skirt of his robe, and it tore.',
      note='Whose robe? Plain sense (Rashi, Radak, Metzudat David): Saul grasped the corner of '
           'SAMUEL\'s me\'il. The midrash cited by Rashi also records the opinion that Samuel tore Saul\'s.'),
    E(id='s1_15_30_honor', src=('I Samuel', 15, 30), q=['כבדני נא נגד זקני עמי ונגד ישראל'],
      status='reference', gloss='Honour me now, I pray you, before the elders of my people and before Israel.'),
    E(id='s1_16_13_anointed', src=('I Samuel', 16, 13), q=None, status='reference',
      gloss='Samuel took the horn of oil and anointed him in the midst of his brothers; and the spirit '
            'of the LORD came upon David from that day forward.',
      note='Chapter 2 of the game.'),
    E(id='s1_16_14_evil_spirit', src=('I Samuel', 16, 14), q=None, status='avoid-in-intro',
      gloss='Now the spirit of the LORD departed from Saul, and an evil spirit from the LORD terrified him.',
      note='Comes only AFTER David\'s anointing (16:13). It must not be shown or depicted (no madness, '
           'no seizures, no lyre-therapy scene) in the chapter-1 intro.'),
    E(id='s1_16_18_david_skills', src=('I Samuel', 16, 18), q=None, status='reference',
      gloss='...a son of Jesse the Bethlehemite, skilful in playing, a mighty man of valour, a man of war, '
            'prudent in speech, a comely person, and the LORD is with him.',
      note='Said to Saul by one of his young men after 16:14; usable for David\'s look, not as a line in '
           'the intro.'),
    E(id='s1_16_19_20_jesse_gift', src=('I Samuel', 16, 19, 20), q=None, status='reference',
      gloss='Saul sent to Jesse: send me David your son who is with the sheep. Jesse took a donkey laden '
            'with bread, a skin of wine and a kid, and sent them by David to Saul.'),
    E(id='s1_17_15_back_and_forth', src=('I Samuel', 17, 15), q=None, status='reference',
      gloss='But David went back and forth from Saul to feed his father\'s sheep at Bethlehem.',
      note='The Bible\'s own juxtaposition of the two worlds - but it belongs to the period after 16:21.'),
    E(id='s1_17_38_39_armor', src=('I Samuel', 17, 38, 39), q=None, status='reference',
      gloss='Saul clad David with his apparel (madav), put a helmet of bronze on his head and clad him '
            'with a coat of mail. David girded his sword upon his apparel...',
      note='Saul\'s own war gear: madim (garment), bronze helmet (קוֹבַע, spelled with qof here), '
           'coat of mail (שִׁרְיוֹן), sword.'),
    E(id='s1_17_42_ruddy_youth', src=('I Samuel', 17, 42), q=['כי היה נער ואדמני עם יפה מראה'],
      status='reference', gloss='...for he was but a youth, and ruddy, and of a fair countenance.'),
    E(id='s1_18_10_11_spear', src=('I Samuel', 18, 10, 11), q=['והחנית ביד שאול'],
      status='avoid-in-intro', gloss='...and Saul had his spear in his hand. And Saul cast the spear...',
      note='Evil-spirit episode (after 16:14). Use only as evidence that the spear was Saul\'s constant '
           'attribute; do not show in the intro.'),
    E(id='s1_19_9_10_spear', src=('I Samuel', 19, 9, 10), q=['והוא בביתו ישב וחניתו בידו'],
      status='avoid-in-intro', gloss='...as he sat in his house with his spear in his hand.',
      note='Evil-spirit episode - do not show in the intro.'),
    E(id='s1_20_24_25_new_moon', src=('I Samuel', 20, 24, 25),
      q=['וישב המלך על מושבו כפעם בפעם אל מושב הקיר'], status='reference',
      gloss='The king sat on his seat as at other times, the seat by the wall; Jonathan rose, and Abner '
            'sat by Saul\'s side.',
      note='New-moon feast (later period). 20:24 ketiv עַל, qere אֶל־הַלֶּחֶם. Rashi: the seat at the head '
           'of the couch by the wall; they dined reclining on couches.'),
    E(id='s1_21_8_doeg', src=('I Samuel', 21, 8), q=['ושמו דאג האדמי אביר הרעים אשר לשאול'],
      status='reference', gloss='...his name was Doeg the Edomite, the chief of the herdsmen that belonged to Saul.'),
    E(id='s1_22_7_fields_vineyards', src=('I Samuel', 22, 7), q=None, status='reference',
      gloss='Hear now, you Benjaminites: will the son of Jesse give every one of you fields and vineyards, '
            'will he make you all captains of thousands and captains of hundreds?'),
    E(id='s1_22_17_runners', src=('I Samuel', 22, 17), q=['ויאמר המלך לרצים הנצבים עליו'],
      status='reference', gloss='And the king said to the runners (guards) that stood about him...',
      note='Context is the massacre at Nob - never quote in the intro. Ketiv אזנו, qere אָזְנִי.'),
    E(id='s1_24_5_corner', src=('I Samuel', 24, 5), q=['ויכרת את כנף המעיל אשר לשאול בלט'],
      status='reference', gloss='...and cut off the skirt of Saul\'s robe privily.',
      note='Hebrew verse numbering (24:4 in many English Bibles). Ketiv איביך, qere אֹיִבְךָ.'),
    E(id='s1_26_7_spear_ground', src=('I Samuel', 26, 7), q=['וחניתו מעוכה בארץ מראשתיו'],
      status='reference', gloss='...his spear stuck in the ground at his head.',
      note='MAM prints the trivial ketiv מְרַאֲשֹׁתָו; qere מְרַאֲשֹׁתָיו.'),
    E(id='s1_26_11_12_water_jug', src=('I Samuel', 26, 11, 12), q=None, status='reference',
      gloss='...take the spear that is at his head and the cruse of water (tzapachat ha-mayim)...'),
    E(id='s1_31_13_tamarisk_jabesh', src=('I Samuel', 31, 13), q=None, status='reference',
      gloss='They took their bones and buried them under the tamarisk tree in Jabesh.',
      note='The tamarisk frames Saul\'s story: he holds court under one (22:6) and is buried under one.'),
    E(id='s2_1_10_diadem', src=('II Samuel', 1, 10), q=['ואקח הנזר אשר על ראשו ואצעדה אשר על זרעו'],
      status='reference', gloss='...and I took the crown (nezer) that was upon his head and the bracelet '
                                '(etz\'adah) that was on his arm.'),
    E(id='s2_1_21_22_shield_sword', src=('II Samuel', 1, 21, 22), q=None, status='reference',
      gloss='...the shield of Saul, not anointed with oil... and the sword of Saul returned not empty.'),
    E(id='s2_1_24_scarlet_gold', src=('II Samuel', 1, 24), q=None, status='reference',
      gloss='Daughters of Israel, weep over Saul, who clothed you in scarlet with delights, who put '
            'ornaments of gold upon your apparel.'),
    E(id='s2_2_8_abner', src=('II Samuel', 2, 8), q=['ואבנר בן נר שר צבא אשר לשאול'], status='reference',
      gloss='Now Abner son of Ner, captain of Saul\'s host...'),
    E(id='s2_5_6_jebus', src=('II Samuel', 5, 6), q=None, status='reference',
      gloss='The king and his men went to Jerusalem against the Jebusites, the inhabitants of the land...',
      note='Jerusalem is still a Jebusite city in Saul\'s time - no Israelite capital, no Temple.'),
    E(id='s2_21_6_gibeah', src=('II Samuel', 21, 6), q=['בגבעת שאול בחיר ה׳'], status='reference',
      gloss='...in Gibeah of Saul, the chosen of the LORD.', note='Ketiv ינתן, qere יֻתַּן.'),
    E(id='isa_10_29_gibeah', src=('Isaiah', 10, 29), q=['חרדה הרמה גבעת שאול נסה'], status='reference',
      gloss='Ramah trembles; Gibeah of Saul has fled.',
      note='Geography: Gibeah of Saul lies on the ridge road north of Jerusalem, next to Ramah and Geba.'),
    E(id='josh_18_28_gibeath', src=('Joshua', 18, 28), q=None, status='reference',
      gloss='...and the Jebusite, the same is Jerusalem, Gibeath, and Kiriath: ... the inheritance of Benjamin.'),
    E(id='jdg_20_15_gibeah_men', src=('Judges', 20, 15), q=None, status='reference',
      gloss='...besides the inhabitants of Gibeah, who numbered seven hundred picked men.'),
    E(id='chr1_12_2_benjamin_archers', src=('I Chronicles', 12, 2), q=None, status='reference',
      gloss='They were armed with bows, and could use both the right hand and the left in slinging '
            'stones and shooting arrows; they were of Saul\'s brethren of Benjamin.'),
    E(id='chr1_8_33_genealogy', src=('I Chronicles', 8, 33), q=None, status='reference',
      gloss='Ner begot Kish, Kish begot Saul, Saul begot Jonathan, Malchishua, Abinadab and Eshbaal.'),
    E(id='s1_8_11_17_king_manner', src=('I Samuel', 8, 11, 17), q=None, status='reference',
      gloss='Samuel\'s warning on "the manner of the king": chariots and horsemen, runners, officers, '
            'perfumers, cooks and bakers, fields, vineyards and olive groves, a tenth of seed and flock.',
      note='A warning about kingship in general, not a description of Saul\'s actual court. Saul is '
           'never said to have chariots or horses.'),
    E(id='exo_25_4_dyes', src=('Exodus', 25, 4), q=None, status='reference',
      gloss='...blue (tekhelet), purple (argaman), scarlet (tola\'at shani), fine linen and goats\' hair.'),
    E(id='ruth_4_17_obed', src=('Ruth', 4, 17), q=['עובד הוא אבי ישי אבי דוד'], status='reference',
      gloss='...they called his name Obed; he is the father of Jesse, the father of David.'),
    E(id='gen_35_20_pillar', src=('Genesis', 35, 20), q=['ויצב יעקב מצבה על קברתה'], status='docs',
      use='README.md (historical accuracy section)', gloss='And Jacob set up a pillar upon her grave.'),
    E(id='s2_23_15_well', src=('II Samuel', 23, 15), q=['מבאר בית לחם אשר בשער'], status='docs',
      use='README.md (Bethlehem well)', gloss='...water of the well of Bethlehem which is by the gate.',
      note='The Aleppo text reads מִבֹּאר (with alef) and בַּשָּׁעַר (pausal qamats).'),

    # ------------------------------------------------------------------ dress, arms, daily life (Torah law + narrative)
    E(id='num_15_38_tzitzit', src=('Numbers', 15, 38),
      q=['ועשו להם ציצת על כנפי בגדיהם לדרתם ונתנו על ציצת הכנף פתיל תכלת'], status='reference',
      gloss='...make them fringes on the corners of their garments throughout their generations, and put '
            'upon the fringe of each corner a thread of blue (tekhelet).',
      note='Four-cornered garments of Israelite men carry tzitzit with a tekhelet thread (Deut 22:12).'),
    E(id='deut_22_11_12_shaatnez_gedilim', src=('Deuteronomy', 22, 11, 12), q=None, status='reference',
      gloss='You shall not wear sha\'atnez, wool and linen together. You shall make twisted fringes on the '
            'four corners of your covering.',
      note='Costume rule: no garment mixing wool and linen.'),
    E(id='lev_19_27_beard', src=('Leviticus', 19, 27), q=None, status='reference',
      gloss='You shall not round the corners of your heads, nor destroy the corners of your beard.',
      note='Adult Israelite men: full beards, side hair not rounded off.'),
    E(id='s1_17_5_7_goliath_armor', src=('I Samuel', 17, 5, 7), q=None, status='reference',
      gloss='Goliath: bronze helmet, coat of scale armour (shiryon qasqasim) of bronze, bronze greaves, a '
            'bronze javelin (kidon), a spear-shaft like a weaver\'s beam with an iron head; a shield-bearer.',
      note='Philistine equipment for contrast; shows that scale armour, bronze and iron coexisted.'),
    E(id='s1_14_1_armor_bearer', src=('I Samuel', 14, 1), q=['הנער נשא כליו'], status='reference',
      gloss='...the young man who bore his armour.', note='Saul and Jonathan each had an armour-bearer (31:4).'),
    E(id='s1_18_4_jonathan_gear', src=('I Samuel', 18, 4), q=None, status='reference',
      gloss='Jonathan stripped off the robe (me\'il) that was upon him and gave it to David, and his '
            'garments, even to his sword, his bow and his girdle.',
      note='The prince\'s outfit: me\'il, madim, sword, bow, belt (later event; for costume design).'),
    E(id='s1_28_14_samuel_meil', src=('I Samuel', 28, 14), q=['איש זקן עלה והוא עטה מעיל'], status='reference',
      gloss='An old man comes up, and he is wrapped in a robe (me\'il).',
      note='Samuel is recognised by his me\'il (cf. 2:19, 15:27).'),
    E(id='s1_9_3_donkeys', src=('I Samuel', 9, 3), q=None, status='reference',
      gloss='The she-asses of Kish, Saul\'s father, were lost...',
      note='Pack and riding animals of the family: donkeys (no horses at Saul\'s court).'),
    E(id='s1_17_17_18_provisions', src=('I Samuel', 17, 17, 18), q=None, status='reference',
      gloss='Parched grain, ten loaves, ten cheeses for the captain of the thousand.'),
    E(id='s1_25_18_provisions', src=('I Samuel', 25, 18), q=None, status='reference',
      gloss='Two hundred loaves, two skins of wine, five dressed sheep, five seahs of parched grain, a '
            'hundred clusters of raisins and two hundred cakes of figs, laden on donkeys.'),
    E(id='s1_17_33_naar', src=('I Samuel', 17, 33), q=['כי נער אתה'], status='reference',
      gloss='...for you are but a youth.'),
    E(id='s2_5_4_thirty', src=('II Samuel', 5, 4), q=None, status='reference',
      gloss='David was thirty years old when he began to reign, and he reigned forty years.'),
    E(id='seder_olam_13_david_29', src=('Seder Olam Rabbah', 13, 2),
      q=['ואותו הפרק נמשח דוד', 'והוא היה בן כ"ט שנים'], status='reference',
      gloss='...and in that period David was anointed ... and he was twenty-nine years old.',
      note='Seder Olam: Saul reigned (alone) about two years; David was anointed in Saul\'s second year, '
           'aged 29, and became king at 30 (2 Sam 5:4). The Bible still calls him נַעַר (17:33, 17:42).'),

    # ------------------------------------------------------------------ rabbinic sources on Saul (verified)
    E(id='yoma_22b_one_year_old', src=('Yoma', 22, 'b', 17), q=None, status='reference',
      gloss='"Saul was a year old when he began to reign" - Rav Huna said: like a one-year-old, who has '
            'never tasted the taste of sin.'),
    E(id='yoma_22b_no_blemish', src=('Yoma', 22, 'b', 19),
      q=['מפני מה לא נמשכה מלכות בית שאול מפני שלא היה בו שום דופי'], status='reference',
      gloss='Why did the kingship of the house of Saul not endure? Because there was no blemish in him '
            '(in his lineage).'),
    E(id='yoma_22b_one_sin', src=('Yoma', 22, 'b', 10),
      q=['שאול באחת ועלתה לו דוד בשתים ולא עלתה לו'], status='reference',
      gloss='Saul [failed] in one matter and it was counted against him; David in two, and it was not.'),
    E(id='yoma_22b_forgave_honor', src=('Yoma', 22, 'b', 20),
      q=['מפני מה נענש שאול מפני שמחל על כבודו'], status='reference',
      gloss='Why was Saul punished? Because he waived his royal honour (1 Sam 10:27).'),
    E(id='yoma_22b_amalek_mercy', src=('Yoma', 22, 'b', 8), q=None, status='reference',
      gloss='When God told Saul "Go and smite Amalek", he reasoned: if for one soul the Torah requires '
            'the heifer ceremony, how much more for all these souls...'),
    E(id='meg_13b_modesty', src=('Megillah', 13, 'b', 1),
      q=['ובשכר צניעות שהיה בו בשאול זכה ויצאת ממנו אסתר'], status='reference',
      gloss='In reward for the modesty that was in Saul, he merited that Esther descended from him.'),
    E(id='meg_13b_modesty_what', src=('Megillah', 13, 'b', 6), q=None, status='reference',
      gloss='What was Saul\'s modesty? "But of the matter of the kingdom, whereof Samuel spoke, he told '
            'him not" (1 Sam 10:16).'),
    E(id='taan_5b_tamarisk', src=('Taanit', 5, 'b', 6),
      q=['וכי מה ענין גבעה אצל רמה אלא לומר לך מי גרם לשאול שישב בגבעה שתי שנים ומחצה תפלתו של שמואל הרמתי'],
      status='reference',
      gloss='What has Gibeah to do with Ramah? It teaches: what caused Saul to sit [as king] in Gibeah '
            'two and a half years? The prayer of Samuel of Ramah.'),
    E(id='mk_16b_distinguished', src=('Moed Katan', 16, 'b', 18),
      q=['מה כושי משונה בעורו אף שאול משונה במעשיו'], status='reference',
      gloss='Just as a Cushite is distinguished by his skin, so Saul was distinguished by his deeds.'),
    E(id='mk_16b_had_you_been_saul', src=('Moed Katan', 16, 'b', 17),
      q=['אלמלי אתה שאול והוא דוד איבדתי כמה דוד מפניו'], status='reference',
      gloss='[God to David:] Were you Saul and he David, I would have destroyed many Davids for his sake.'),
    E(id='brr_63_8_ruddy', src=('Bereshit Rabbah', 63, 8),
      q=['וכיון שראה שמואל את דוד אדמוני', 'נתירא ואמר אף זה שופך דמים כעשו',
         'עשו מדעת עצמו הוא הורג אבל זה מדעת סנהדרין הוא הורג'], status='reference',
      gloss='When Samuel saw that David was ruddy... he was afraid and said: this one too will shed blood '
            'like Esau. [God answered: "with beautiful eyes"] - Esau kills of his own will, this one '
            'only by the verdict of the Sanhedrin.'),
    E(id='shr_2_2_moses_kid', src=('Shemot Rabbah', 2, 2),
      q=['הרכיבו על כתפו והיה מהלך'], status='reference',
      gloss='[Moses] put the kid on his shoulder and walked.',
      note='This lamb-on-the-shoulders image belongs to MOSES in the midrash, not David. The game\'s '
           'ending (David carrying the rescued lamb) is an artistic choice - never caption it with this text.'),
    E(id='tj_s1_22_6_spear', src=('Targum Jonathan on I Samuel', 22, 6), q=['ומורניתיה בידיה'],
      status='reference', gloss='Targum: "and his spear (murnita) in his hand".'),
    E(id='tj_s1_16_12_ruddy', src=('Targum Jonathan on I Samuel', 16, 12), q=['והוא סמוק עינוהי יאין ושפיר בריויה'],
      status='reference', gloss='Targum: "and he was ruddy (samoq), his eyes beautiful and his appearance fine".',
      note='The Targum reads אַדְמוֹנִי as a ruddy complexion.'),
    E(id='radak_s1_17_42_ruddy', src=('Radak on I Samuel', 17, 42, 1), q=None, status='reference',
      gloss='Radak: Goliath despised him not for being a youth but for being ruddy and handsome - he thought '
            'such a man could not be a warrior, for one who goes to war loses his beauty from toil and '
            'exposure to cold, rain and heat.',
      note='Art direction: David\'s face should read fresh and ruddy, not weather-beaten.'),
    E(id='rashi_s1_22_6_tamarisk', src=('Rashi on I Samuel', 22, 6, 2), q=None, status='reference',
      gloss='Rashi: a (place called) Ramah in the border of Benjamin; the Rabbis (Taanit 5b) say it '
            'alludes to Samuel\'s Ramah - Saul sat in Gibeah by the merit of the great "tamarisk" in '
            'Ramah (Samuel) who prayed for him.'),
    E(id='radak_s1_22_6_height', src=('Radak on I Samuel', 22, 6, 3), q=None, status='reference',
      gloss='Radak: "Ramah" was a high place in Gibeah of Saul, called ramah because it was elevated.'),
    E(id='radak_s1_15_34_royal_house', src=('Radak on I Samuel', 15, 34, 1),
      q=['ובנה שם שאול בית מלוכה'], status='reference',
      gloss='Radak: possibly this is Gibeah of Benjamin, and Saul built a royal house there, hence it was '
            'named after him; or it was another hill that Saul built up.'),
    E(id='rashi_s1_20_25_reclining', src=('Rashi on I Samuel', 20, 25, 2),
      q=['שדרכן היה לאכל מסבין על המטות'], status='reference',
      gloss='Rashi: their custom was to eat reclining on couches.'),
    E(id='radak_s1_16_7_saul', src=('Radak on I Samuel', 16, 7, 2),
      q=['ושאול הוא שהיה יפה מראה וגבה קומה'], status='reference',
      gloss='Radak (citing "some explain"): ...and it was Saul who was handsome and tall.'),
    E(id='rashi_s1_17_38_garments', src=('Rashi on I Samuel', 17, 38, 1), q=None, status='reference',
      gloss='Rashi: Saul\'s garments miraculously fitted David, though Saul was taller than all the '
            'people from his shoulders upward.'),
]
