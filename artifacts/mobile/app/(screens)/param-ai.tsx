import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  { emoji: "🎓", text: "Career guidance after JNV" },
  { emoji: "📚", text: "How to prepare for JEE?" },
  { emoji: "🏥", text: "NEET preparation tips" },
  { emoji: "🏛️", text: "UPSC strategy for Navodayans" },
  { emoji: "💼", text: "Best career options after Class 12" },
  { emoji: "🌍", text: "Scholarships for JNV students" },
];

// Comprehensive knowledge base for intelligent responses
const KNOWLEDGE_BASE: { patterns: RegExp[]; response: (q: string) => string }[] = [
  {
    patterns: [/jee|iit|engineering entrance|b\.?tech/i],
    response: () => `**JEE Preparation Guide for Navodayans** 🎯

JNV gives you an incredible foundation. Here's a complete roadmap:

**Phase 1 – Foundation (Class 9–10)**
• Master NCERT Physics, Chemistry, Maths thoroughly
• Build strong conceptual clarity — don't rote-learn formulas
• Practice 20–30 problems daily per subject

**Phase 2 – Serious Prep (Class 11)**
• Join JEE-focused coaching (online: PW, Vedantu, Unacademy or offline)
• Cover: Mechanics, Thermodynamics, Organic Chemistry, Calculus, Algebra
• Solve HC Verma (Physics), NCERT Exemplar, RD Sharma

**Phase 3 – Revision + Mocks (Class 12)**
• Attempt full-length mock tests every week
• Analyse errors — don't repeat the same mistakes
• Focus on your weak chapters in the last 3 months
• Previous year papers (2010–2024) are a must

**Key Stats**: Over 800 JNV alumni crack JEE Advanced yearly. AIR under 1000 is very achievable with focused prep.

**JNV Advantage**: Your residential schooling has given you discipline and time management — use these!

Would you like subject-specific tips or a month-by-month study plan?`,
  },
  {
    patterns: [/neet|mbbs|medical|aiims|doctor/i],
    response: () => `**NEET Preparation for Navodayans** 🏥

NEET is about smart study, not just hard study. Here's your complete guide:

**Subjects & Weightage**
• Biology: 360 marks (50%) — your highest priority
• Physics: 180 marks (25%)
• Chemistry: 180 marks (25%)

**Biology Strategy (Most Important)**
• NCERT Biology (Class 11 + 12) — read every line, memorise diagrams
• Human Physiology, Genetics, Ecology have highest weightage
• Make short notes for Kingdoms, Plant Physiology
• Revise NCERT at least 4–5 times

**Physics & Chemistry**
• Physics: Master concepts, NCERT + previous year MCQs
• Chemistry: Organic reactions + NCERT Inorganic = scoring
• Physical Chemistry: Practice numericals daily

**Practice Schedule**
• 100+ MCQs daily from weak areas
• Full mock test every 2 weeks
• Analyse solutions — understand WHY you got it wrong

**Target**: NEET cutoff for AIIMS Delhi is ~685/720. Government medical colleges need 550+.

JNV students have a strong biology base from school labs. Many Navodayans are now doctors at AIIMS, JIPMER, and government medical colleges across India.

Want a day-by-day NEET timetable?`,
  },
  {
    patterns: [/upsc|ias|ips|civil service|collector|district magistrate/i],
    response: () => `**UPSC Civil Services – The Navodayan Path** 🏛️

JNV alumni have a fantastic track record in UPSC. Here's everything you need:

**Why Navodayans Excel**
✅ Multilingual exposure (Hindi + English + regional language)
✅ Discipline from residential schooling
✅ Strong GK base from diverse peer interactions
✅ Leadership experience from house activities

**Complete Roadmap**

**Early Preparation (Start from Class 11/12)**
• Read newspapers daily — The Hindu or Indian Express
• Follow current affairs: economy, polity, environment
• Build reading habit: 2–3 hours/day

**Graduation Phase**
• Complete NCERT (6th–12th): History, Geography, Polity, Economy, Science
• Choose your Optional subject wisely (scoring optionals: Geography, Public Admin, Sociology)
• Join a test series in final year

**Mains & Interview**
• Answer writing practice: 2 answers/day
• Ethics & GS Paper 4 — very important, often ignored
• Mock interviews 3 months before

**Timeline**: Most toppers crack UPSC in 3–4 attempts. Average age of selection: 26–27 years.

**JNV Alumni in UPSC**: Hundreds of Navodayans serve as IAS, IPS, IFS officers. The JNV network is a huge support system during preparation.

Want study material recommendations or optional subject guidance?`,
  },
  {
    patterns: [/career|what (to|should) (do|study|pursue)|after (class )?12|after jnv|future/i],
    response: () => `**Career Guidance for Navodayans** 🎯

You have exceptional opportunities after JNV. Here are the top paths:

**Science Stream**
• 🔬 Engineering → JEE Main/Advanced → IIT/NIT/IIIT
• 🏥 Medicine → NEET → MBBS at AIIMS/Govt. Medical College
• 🔭 Pure Science → BSc → IISc/IITs (research path)
• 💻 Computer Science → Direct CS degree + coding skills

**Commerce Stream**
• 📊 CA (Chartered Accountant) → Most prestigious commerce career
• 🏦 MBA → CAT after graduation → IIM
• 💹 Banking → IBPS/SBI PO exams

**Humanities/Arts**
• 🏛️ UPSC Civil Services → IAS/IPS/IFS
• ⚖️ Law → CLAT → National Law Universities
• 📰 Journalism/Mass Communication
• 🎭 Arts & Culture careers

**Emerging Fields (High Demand)**
• Artificial Intelligence & Data Science
• Cybersecurity
• Renewable Energy
• Healthcare Technology

**Scholarships for Navodayans**
• NVS Scholarship for higher education
• Central Sector Scholarship (Merit-based)
• State government merit scholarships
• Private scholarships: Tata, Reliance Foundation

Which stream are you in? I can give you a detailed, personalised roadmap!`,
  },
  {
    patterns: [/scholarship|financial (help|aid|support)|fee|money|education loan/i],
    response: () => `**Scholarships & Financial Support for JNV Students** 💰

JNV students are eligible for many scholarships. Here's a comprehensive list:

**Government Scholarships**

1. **Central Sector Scheme of Scholarships**
   • For Class 12 passouts with 80%+ marks
   • ₹10,000/year for graduation, ₹20,000/year for PG
   • Apply on National Scholarship Portal (NSP)

2. **NVS Merit Scholarship**
   • For top-performing JNV students
   • Covers further education costs

3. **Post-Matric Scholarship (SC/ST/OBC)**
   • Full fee coverage + maintenance allowance
   • Apply via NSP within 3 months of admission

4. **Prime Minister's Special Scholarship Scheme**
   • For students from J&K and North-East states

**Private/Foundation Scholarships**

• **Tata Scholarship** – For IIT students (up to ₹8 lakh/year)
• **Reliance Foundation Scholarship** – UG & PG level
• **Buddy4Study** – Aggregator for 500+ scholarships
• **HDFC Badhte Kadam** – Meritorious students from low-income families
• **Swami Vivekananda Merit-cum-Means Scholarship** – West Bengal students

**Education Loans**
• Vidya Lakshmi Portal – Single window for education loans
• Moratorium period: Course duration + 1 year
• Tax benefit on interest (Section 80E)

Want help identifying which scholarships you're eligible for?`,
  },
  {
    patterns: [/jnv|navodaya|nvs|navodaya vidyalaya|jnvst/i],
    response: () => `**About Jawahar Navodaya Vidyalayas (JNV)** 🏫

JNVs are among India's finest schools. Here's what makes them special:

**About JNVs**
• Established: 1986 under National Policy on Education
• Governed by: Navodaya Vidyalaya Samiti (NVS), under Ministry of Education
• Total JNVs: 661+ across India (one per district target)
• Residential: Class 6 to 12, fully funded by Government of India
• Selection: JNVST (Jawahar Navodaya Vidyalaya Selection Test) at Class 5

**Key Features**
✅ Free education, boarding, lodging, uniforms, books
✅ Migration Policy: Students migrate across states for cultural exposure
✅ Trilingual education (Hindi, English + regional language)
✅ House system: Aravali, Nilgiri, Shivalik, Udaygiri
✅ Strong alumni network across every profession

**JNVST Selection Test**
• Conducted by NVS every year for Class 6 admission
• Tests: Mental Ability, Arithmetic, Language
• Quota: 75% rural students, 1/3 seats for girls, SC/ST reserved seats

**JNV Alumni Achievements**
• IIT toppers, AIIMS doctors, IAS/IPS officers
• Scientists, entrepreneurs, defence personnel
• Over 30 lakh alumni serving the nation

**Rankings & Awards**
• JNVs consistently rank among top government schools in India
• Several JNVs have 100% board results year after year

What would you like to know more about JNV life?`,
  },
  {
    patterns: [/mentor|senior|alumni.*connect|connect.*alumni|guidance|advice/i],
    response: () => `**Connecting with JNV Alumni Mentors** 🤝

The JNV alumni network is one of the strongest in India. Here's how to make the most of it:

**How to Connect on Navodaya Connect**
1. Go to the **Alumni** tab → Browse by profession
2. Filter by: Engineering, Medicine, IAS/IPS, Defence, Research
3. Tap on a mentor's profile → Send a mentorship request
4. Join **Chat Groups** → Look for alumni groups in your field

**What Mentors Can Help With**
• Career path guidance specific to your interests
• Entrance exam strategies (JEE, NEET, UPSC, CLAT)
• College selection and application tips
• Scholarship and financial aid information
• Job referrals and internship opportunities
• Mental health support during tough exam periods

**Tips for Reaching Out**
✅ Be specific about what you need help with
✅ Mention your current class and career interest
✅ Respect their time — prepare your questions in advance
✅ Follow up with progress updates (mentors love this!)

**Community Groups Available**
• JEE/NEET Aspirants Group
• UPSC Preparation Group
• Tech Careers Alumni
• Medical Alumni Network
• Defence Services Group

The Navodayan bond is real — seniors genuinely want to help juniors succeed!

Would you like tips on how to write your first message to a mentor?`,
  },
  {
    patterns: [/defence|army|navy|airforce|nda|military|crpf|bsf/i],
    response: () => `**Defence Careers for Navodayans** 🎖️

JNV's discipline and physical culture make it a perfect launchpad for defence careers!

**NDA (National Defence Academy)**
• After Class 12 — most popular defence entry
• Written exam + SSB interview
• Leads to commission as Army/Navy/Air Force officer
• Age: 16.5 to 19.5 years at time of examination
• Eligibility: PCM for Army/Air Force/Navy (pilot), any stream for Army

**Technical Entry Scheme (TES)**
• Direct entry for PCM students without written exam
• 12th marks + SSB
• Become an Army officer after 4-year engineering course at CME/MCEME

**Other Defence Entries**
• **CDS (Combined Defence Services)** – After graduation
• **AFCAT** – Air Force technical and flying branches
• **Indian Coast Guard** – After 12th or graduation
• **CAPF (CRPF, BSF, CISF)** – Through UPSC

**Physical Preparation**
• 1.6 km run in under 7 minutes (NDA standard)
• 10 push-ups, 20 sit-ups as minimum
• Swimming recommended for Navy aspirants

**SSB Interview Tips**
• GTO tasks: leadership, team skills
• Psychological tests: TAT, WAT, SRT
• Personal interview: confidence, awareness

JNV's House system, sports culture, and discipline give you a head start. Many Navodayans are serving officers!

Want specific NDA exam preparation guidance?`,
  },
  {
    patterns: [/study (tips|habit|schedule|routine|method)|how to study|concentration|focus/i],
    response: () => `**Effective Study Techniques for JNV Students** 📚

Science-backed study methods that actually work:

**The Fundamentals**

**1. Active Recall (Most Powerful Technique)**
• Don't re-read — test yourself instead
• Cover your notes and try to recall key points
• Use flashcards for formulas, dates, definitions
• This builds long-term memory 3x faster than re-reading

**2. Spaced Repetition**
• Review material after: 1 day → 3 days → 1 week → 1 month
• Apps: Anki (free) is excellent for this
• Never cram the night before exams

**3. Pomodoro Technique**
• Study 25 minutes → 5-minute break → repeat
• After 4 rounds, take 15–30 minute break
• Maintains focus without burnout

**4. Feynman Technique**
• Try to explain a concept as if teaching a child
• Where you stumble = your weak points
• Go back and fill those gaps

**5. The Cornell Note-Taking Method**
• Divide page: main notes | cue words | summary
• Review cue words to test yourself later

**Daily Study Schedule (Recommended)**
• Morning (6–8 AM): Difficult subjects (freshest mind)
• After school: Light revision, homework
• Evening (7–10 PM): Problem solving + new concepts
• Before bed: Quick 15-min review of the day

**What to Avoid**
❌ Studying for hours without breaks
❌ Highlighting without understanding
❌ Passive re-reading
❌ Using phone during study time (even 1 notification breaks 23 mins of focus)

Which subject or exam are you preparing for? I can give targeted advice!`,
  },
  {
    patterns: [/mental health|stress|anxiety|pressure|depressed|overwhelmed|motivation/i],
    response: () => `**Mental Well-being for Navodayans** 💚

Being away from home is tough. Exam pressure is real. You're not alone.

**What You're Feeling Is Normal**
JNV life — with its pressures, homesickness, and high expectations — can be overwhelming. Thousands of Navodayans have felt exactly what you're feeling.

**Practical Coping Strategies**

**For Stress & Anxiety**
• Deep breathing: Inhale 4 sec → Hold 4 sec → Exhale 4 sec (Box breathing)
• 10-minute morning walk — sunlight resets your mood naturally
• Write down 3 things you're grateful for each evening
• Limit news/social media if they increase anxiety

**For Exam Pressure**
• Break big goals into small daily tasks — cross them off as done
• Celebrate small wins — finishing a chapter is worth acknowledging
• Remember: One exam does not define your life
• Many toppers failed multiple attempts before succeeding

**For Homesickness**
• Schedule regular calls with family (don't skip these)
• Form close friendships in your house group
• Keep a small meaningful item from home in your room

**For Motivation Loss**
• Read biographies of JNV alumni who succeeded (plenty on YouTube)
• Revisit your "why" — why did you join JNV? What's your dream?
• Talk to a friend, teacher, or alumni mentor honestly

**Getting Help**
• Speak to your class teacher or warden — they understand JNV life
• iCall Helpline: 9152987821 (free, confidential)
• Vandrevala Foundation: 1860-2662-345 (24/7)

You are more resilient than you know. What's on your mind today?`,
  },
  {
    patterns: [/language|english|hindi|spoken|communication|writing/i],
    response: () => `**Language & Communication Skills for Navodayans** 🗣️

JNV's trilingual environment is actually a superpower. Here's how to make it work for you:

**Improving English**
• Read 1 English article/editorial daily (The Hindu, BBC)
• Watch English content with subtitles (TED Talks, documentaries)
• Write a short diary entry in English every night (even 5 lines)
• Speak in English with classmates for 30 mins daily — make it a game!
• Learn 5 new words per day and use them in sentences

**Improving Hindi**
• Hindi is an advantage in UPSC and government jobs
• Read Hindi newspapers: Dainik Jagran, Amar Ujala
• Watch Hindi debates and news

**Public Speaking (Very Important)**
• Join your school's debate and elocution activities
• Practice speaking in front of a mirror
• Record yourself speaking and listen back — you'll improve fast
• Take every opportunity to speak in class — confidence grows with repetition

**Written Communication**
• For UPSC/exams: Practise answer writing daily
• For professional life: Learn formal email writing
• Keep sentences short and clear — clarity > complexity

**Regional Language**
• Don't neglect your mother tongue — bilingual people have cognitive advantages
• It connects you to your roots and culture

The JNV migration policy (moving across states) already gives you exposure that most students never get. Use it!

Want to practise an essay topic or need help with interview communication?`,
  },
  {
    patterns: [/sport|cricket|football|athletics|physical|fitness|yoga/i],
    response: () => `**Sports & Physical Development at JNV** ⚽

JNV's sports culture is one of its greatest strengths. Here's how to maximise it:

**JNV Sports Opportunities**
• Inter-JNV National Sports Tournament (annual)
• State-level competitions in Athletics, Football, Volleyball, Kabaddi
• House sports competitions (Aravali, Nilgiri, Shivalik, Udaygiri)
• National Children's Science Congress & cultural events

**Career in Sports**
• National sports quotas in many government jobs (Railways, Police, Army)
• Khelo India program: scholarships for talented athletes
• Sports Authority of India (SAI) training centres
• Many JNV alumni represent state/national teams

**Physical Fitness Routine (For Students)**
Morning (30 min):
• 10 min jog/run
• Push-ups, sit-ups, pull-ups
• Stretching & flexibility

Evening (Sports practice):
• Focus on your chosen sport
• Skill drills > just playing

**For NDA/Defence Aspirants**
• Running: Build up to 1.6 km in under 7 minutes
• Swimming: Start early, it's tested in Navy
• Upper body strength: Pull-ups are key

**Yoga Benefits**
• Surya Namaskar: 12 rounds = full body workout
• Pranayama (breathing): Reduces exam stress significantly
• Just 20 minutes/morning improves focus for the entire day

Sports and academics together build a complete personality — exactly what JNV aims for!`,
  },
  {
    patterns: [/hello|hi |hey |namaste|namaskar|good (morning|afternoon|evening|night)/i],
    response: (q: string) => {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      return `${greeting}! 👋 I'm PA₹AM AI — your personal advisor for all things JNV, career, education, and life!

I can help you with:
• 🎓 **Career Guidance** — JEE, NEET, UPSC, Defence, and more
• 📚 **Study Tips** — Effective techniques, timetables, subject strategies
• 🏫 **JNV Life** — Scholarships, alumni connections, house activities
• 💚 **Well-being** — Managing stress, staying motivated
• 🌍 **General Knowledge** — Current affairs, history, science

What's on your mind today? Ask me anything — I'm here to help!`;
    },
  },
  {
    patterns: [/thank|thanks|thank you|helpful|great answer|good answer/i],
    response: () => `You're very welcome! 😊

That's what PA₹AM AI is here for — to support every Navodayan on their journey.

**Remember**: Every question you ask, every book you read, every challenge you face is making you stronger. The Navodayan spirit is all about turning potential into achievement.

Feel free to ask me anything else — career guidance, exam prep, JNV life, or even just to talk through what's on your mind.

*Jai Hind! 🇮🇳*`,
  },
  {
    patterns: [/what (can|do) you (do|know|help)|your (feature|capabilit|function)|about you|who are you/i],
    response: () => `**I'm PA₹AM AI** — Your Navodaya Intelligence Advisor 🤖

Here's what I can help you with:

**📚 Education & Exams**
• JEE, NEET, UPSC, CLAT, NDA preparation strategies
• Subject-wise tips for Class 6–12
• Study techniques and timetables

**🎓 Career Guidance**
• Career paths after Class 10 and 12
• College selection and admission processes
• Scholarships and financial aid

**🏫 JNV Life**
• School activities, house system, migration policy
• Alumni network connections
• JNV history and achievements

**💼 Professional Development**
• Internships and job search tips
• Interview preparation
• Communication and soft skills

**💚 Personal Well-being**
• Managing exam stress and anxiety
• Motivation and goal-setting
• Work-life balance

**🌍 General Knowledge**
• Current affairs, science, history, geography
• India-specific knowledge for competitive exams

I support **follow-up questions** — ask me to go deeper on any topic, and I'll provide detailed, personalised guidance!

What would you like to explore first?`,
  },
];

function getResponse(question: string, history: Message[]): string {
  const q = question.trim();

  // Check knowledge base in order
  for (const entry of KNOWLEDGE_BASE) {
    if (entry.patterns.some((p) => p.test(q))) {
      return entry.response(q);
    }
  }

  // Context-aware follow-up handling
  if (history.length > 0) {
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    const lastUser = [...history].reverse().find((m) => m.role === "user");

    if (/more|elaborate|explain|detail|tell me more|yes|go ahead|continue|next/i.test(q)) {
      return `Happy to go deeper! Could you tell me which part you'd like me to expand on? For example:

• **Specific subject tips** — Which chapter or topic?
• **Step-by-step plan** — What's your current preparation level?
• **More examples** — Which specific scenario?

The more specific your question, the more tailored my guidance will be! 😊`;
    }

    if (/no|not (that|this)|different|something else|other/i.test(q)) {
      return `Understood! Let me approach this differently. Could you tell me a bit more about:

• What you're currently studying (class/grade)
• Your career interest or dream goal
• The specific challenge you're facing

With that context, I can give you much more relevant and personalised advice!`;
    }
  }

  // Intelligent general response with topic detection
  const topics = [
    { keywords: /math|maths|mathematics|algebra|calculus|geometry/i, topic: "Mathematics", tip: "practice problems daily — math is a skill built through repetition, not just understanding" },
    { keywords: /physics|mechanics|thermodynamics|optics|electricity/i, topic: "Physics", tip: "always derive formulas from first principles before memorising them" },
    { keywords: /chemistry|organic|inorganic|periodic table|reaction/i, topic: "Chemistry", tip: "connect organic reactions through mechanisms — don't memorise, understand" },
    { keywords: /biology|cell|genetics|evolution|ecology|anatomy/i, topic: "Biology", tip: "NCERT is your bible — read every line, especially bold text and diagrams" },
    { keywords: /history|ancient|medieval|modern|freedom|independence/i, topic: "History", tip: "create timelines and connect events to understand cause-and-effect, not just dates" },
    { keywords: /geography|map|climate|river|mountain|continent/i, topic: "Geography", tip: "always study with a physical atlas open — spatial memory is powerful" },
    { keywords: /computer|coding|programming|python|java|software/i, topic: "Computer Science", tip: "learn by building projects, not just reading theory" },
  ];

  for (const { keywords, topic, tip } of topics) {
    if (keywords.test(q)) {
      return `Great question about **${topic}**! 📚

Here's my key advice: **${tip}**.

For ${topic} specifically:
• Start with NCERT textbook — master the basics completely
• Solve at least 20 problems daily on this subject
• Focus on understanding concepts, not just memorising answers
• Watch video explanations for topics you find confusing (YouTube has excellent free resources)

Could you tell me more about what specifically you're struggling with or preparing for? Are you studying for:
• Board exams (Class 10/12)?
• A competitive entrance (JEE/NEET/UPSC)?
• General understanding?

With that detail, I can give you a very specific study plan! 🎯`;
    }
  }

  // Default intelligent response
  return `That's an interesting question! Let me share what I know about this.

**"${q.slice(0, 60)}${q.length > 60 ? "..." : ""}"**

I want to give you the most accurate and helpful answer possible. To do that well, could you tell me a bit more about:

1. **Your context** — Are you a student, alumni, teacher, or official?
2. **Your goal** — What outcome are you hoping for?
3. **Your current situation** — What have you already tried or considered?

I'm particularly strong in these areas:
• 🎓 Career guidance and exam preparation (JEE, NEET, UPSC, NDA)
• 📚 Study techniques and subject-specific tips
• 🏫 JNV-related questions (scholarships, alumni network, school life)
• 💚 Managing stress and staying motivated

Feel free to rephrase your question or pick one of the suggested topics above — I'm here to help! 😊`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ParamAIScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom;
  const typingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(typingAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingAnim.setValue(0);
    }
  }, [loading]);

  const sendMessage = (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", text: text.trim(), timestamp: new Date() };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput("");
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    // Variable delay for more natural feel (longer for complex questions)
    const delay = text.length > 50 ? 1800 : 1200;
    setTimeout(() => {
      const reply = getResponse(text, updatedHistory);
      setMessages((prev) => [...prev, { id: Date.now().toString() + "r", role: "assistant", text: reply, timestamp: new Date() }]);
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, delay);
  };

  const hasMessages = messages.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient colors={["#6D5FFA", "#4B6EF5"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.aiDot} />
          <Text style={styles.headerTitle}>PA₹AM AI</Text>
        </View>
        {hasMessages ? (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setMessages([])}>
            <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: bottomPad + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!hasMessages ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeIconWrap}>
              <Ionicons name="hardware-chip-outline" size={40} color="#6D5FFA" />
            </View>
            <Text style={styles.welcomeTitle}>Your Personal AI Advisor</Text>
            <Text style={styles.welcomeSubtitle}>Powered by PA₹AM AI</Text>
            <Text style={styles.welcomeDesc}>
              Ask me anything about career guidance, exam preparation, JNV life, scholarships, or just talk. I'm here to help!
            </Text>

            <Text style={styles.tryLabel}>TRY ASKING ABOUT</Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s.text}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(s.text)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.suggestionEmoji}>{s.emoji}</Text>
                  <Text style={styles.suggestionText}>{s.text}</Text>
                  <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.messages}>
            {messages.map((msg) => (
              <View key={msg.id} style={msg.role === "user" ? styles.userRow : styles.aiRow}>
                {msg.role === "assistant" && (
                  <View style={styles.aiAvatar}>
                    <Ionicons name="hardware-chip" size={14} color="#6D5FFA" />
                  </View>
                )}
                <View style={[styles.bubble, msg.role === "user" ? styles.bubbleUser : styles.bubbleAI]}>
                  {msg.role === "assistant" && (
                    <Text style={styles.aiLabel}>PA₹AM AI</Text>
                  )}
                  <Text style={[styles.bubbleText, msg.role === "user" && styles.bubbleTextUser]}>
                    {msg.text}
                  </Text>
                  <Text style={[styles.timeText, msg.role === "user" && { color: "rgba(255,255,255,0.6)" }]}>
                    {formatTime(msg.timestamp)}
                  </Text>
                </View>
              </View>
            ))}
            {loading && (
              <View style={styles.aiRow}>
                <View style={styles.aiAvatar}>
                  <Ionicons name="hardware-chip" size={14} color="#6D5FFA" />
                </View>
                <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
                  <View style={styles.typingWrap}>
                    {[0, 1, 2].map((i) => (
                      <Animated.View
                        key={i}
                        style={[styles.typingDot, {
                          opacity: typingAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3 + i * 0.2, 1 - i * 0.2],
                          }),
                          transform: [{
                            translateY: typingAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, i === 1 ? -4 : -2],
                            }),
                          }],
                        }]}
                      />
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: bottomPad + 8 }]}>
        <TextInput
          style={styles.inputBox}
          placeholder="Ask PA₹AM AI anything..."
          placeholderTextColor="#9CA3AF"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendMessage(input)}
          returnKeyType="send"
          multiline={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <Text style={styles.disclaimer}>PA₹AM AI is designed for JNV community guidance. Verify important decisions with qualified professionals.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  clearBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#A3E635" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  body: { flex: 1 },
  bodyContent: { flexGrow: 1 },
  welcome: { alignItems: "center", paddingHorizontal: 24, paddingTop: 28 },
  welcomeIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  welcomeTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1E1B4B", textAlign: "center", marginBottom: 4 },
  welcomeSubtitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6D5FFA", marginBottom: 10 },
  welcomeDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  tryLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 14 },
  suggestions: { gap: 10, width: "100%" },
  suggestionChip: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  suggestionEmoji: { fontSize: 18 },
  suggestionText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#111827" },
  messages: { padding: 16, gap: 10 },
  userRow: { flexDirection: "row", justifyContent: "flex-end" },
  aiRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  bubble: { maxWidth: "80%", borderRadius: 18, padding: 14 },
  bubbleUser: { backgroundColor: "#6D5FFA", borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: "#fff", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#F0F0F0", flex: 1 },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 18, maxWidth: 80 },
  aiLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#6D5FFA", marginBottom: 6 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", lineHeight: 22 },
  bubbleTextUser: { color: "#fff" },
  timeText: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginTop: 6, alignSelf: "flex-end" },
  typingWrap: { flexDirection: "row", gap: 5, alignItems: "center", height: 16 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#6D5FFA" },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F0F0F0", gap: 10 },
  inputBox: { flex: 1, backgroundColor: "#F5F6FA", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", borderWidth: 1, borderColor: "#E5E7EB" },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#6D5FFA", alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: "#9CA3AF" },
  disclaimer: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center", paddingBottom: 8, backgroundColor: "#fff", paddingHorizontal: 16 },
});
