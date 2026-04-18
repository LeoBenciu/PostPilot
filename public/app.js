const LANGUAGE_KEY = "postpilot_language";
const sessionId = "session-main";
let accountState = null;
let isSendingMessage = false;

const authGate = document.getElementById("authGate");
const chatApp = document.getElementById("chatApp");
const signupForm = document.getElementById("signupForm");
const signinForm = document.getElementById("signinForm");
const signupFeedback = document.getElementById("signupFeedback");
const signinFeedback = document.getElementById("signinFeedback");
const signinModal = document.getElementById("signinModal");
const openSignin = document.getElementById("openSignin");
const openTrialBtn = document.getElementById("openTrialBtn");
const closeSignin = document.getElementById("closeSignin");
const closeOnboarding = document.getElementById("closeOnboarding");
const disconnectBtn = document.getElementById("disconnectBtn");
const resetChatBtn = document.getElementById("resetChatBtn");
const agentViewBtn = document.getElementById("agentViewBtn");
const analyticsViewBtn = document.getElementById("analyticsViewBtn");
const agentView = document.getElementById("agentView");
const analyticsView = document.getElementById("analyticsView");
const manageBillingBtn = document.getElementById("manageBillingBtn");
const cancelSubscriptionBtn = document.getElementById("cancelSubscriptionBtn");
const connectLinkedinBtn = document.getElementById("connectLinkedinBtn");
const connectInstagramBtn = document.getElementById("connectInstagramBtn");
const disconnectLinkedinBtn = document.getElementById("disconnectLinkedinBtn");
const disconnectInstagramBtn = document.getElementById("disconnectInstagramBtn");
const languageSelect = document.getElementById("languageSelect");
const languageSelectOnboard = document.getElementById("languageSelectOnboard");
const googleSignupBtn = document.getElementById("googleSignupBtn");
const googleSigninBtn = document.getElementById("googleSigninBtn");
const disconnectConfirmModal = document.getElementById("disconnectConfirmModal");
const disconnectCancelBtn = document.getElementById("disconnectCancelBtn");
const disconnectConfirmBtn = document.getElementById("disconnectConfirmBtn");
const authToast = document.getElementById("authToast");
const onboardingModal = document.getElementById("onboardFlow");
let onboardingHideTimer = null;
let currentLanguage = localStorage.getItem(LANGUAGE_KEY) || "en";

const I18N = {
  en: {
    language: "Language",
    heroBadge: "Founding Access - Intro Offer",
    heroTitleMain: "Build Your Audience Faster.",
    heroTitleAccent: "With an AI Coach in Your Corner.",
    heroSubtitle: "Receive one tailored content direction each day and the confidence to publish it.",
    signal1: "Tailored prompts every day",
    signal2: "Feedback matched to your tone",
    signal3: "Straight advice. No filler.",
    socialProofTitle: "Creators Trust PostPilot",
    socialProofSubtitle: "Thousands are creating with more clarity and confidence",
    testimonial1Quote: "\"It reviewed my Instagram and explained exactly what my audience responds to.\"",
    testimonial1Role: "Freedom & Purpose Coach",
    testimonial2Quote: "\"It brought back confidence in my voice - I finally knew what to post.\"",
    testimonial2Role: "Life & Fitness Glow-Up Coach",
    testimonial3Quote: "\"It was honest and specific - no fake hype. Exactly what I needed.\"",
    testimonial3Role: "Health & Wellness Coach",
    achieveTitle: "What Changes for You",
    achieveSubtitle: "PostPilot does more than suggest ideas - it upgrades your full creation process.",
    feature1Title: "Grow your audience with momentum",
    feature1Text: "Consistent, high-impact content that speaks to the right people",
    feature2Title: "Create in a rhythm that fits you",
    feature2Text: "Turn repeatable wins into your recognizable creator style",
    feature3Title: "Post with confidence every day",
    feature3Text: "Stop second-guessing and start shipping with clarity",
    feature4Title: "Make publishing automatic",
    feature4Text: "Move from forced posting to a sustainable content habit",
    comingSoonBadge: "Up Next",
    comingSoonTitle: "More Powerful Features Are Coming",
    comingSoonSubtitle: "We are actively building the next layer of creator tools.",
    chip1: "Smart AI video assistant",
    chip2: "Performance insight hub",
    chip3: "Carousel draft builder",
    chip4: "Daily publishing planner",
    chip5: "Evergreen idea library",
    finalCtaTitle: "You do not need another noisy platform.",
    finalCtaSubtitle: "You need a coach that helps you act on your best ideas.",
    finalCtaClosing: "That is PostPilot.",
    finalCtaGuarantee: "",
    finalLegalNote: "PostPilot Studio 2026 - Designed for independent creators.",
    signupTitle: "Try PostPilot",
    continueGoogle: "Continue with Google",
    or: "or",
    fullName: "Full name",
    emailAddress: "Email address",
    password: "Password",
    tipsOptIn: "Send me Creator tips and other opportunities",
    createAccount: "Create account",
    guarantee1: "",
    guarantee2: "",
    alreadyAccount: "Already have an account?",
    signIn: "Sign in",
    agentView: "Agent",
    analyticsView: "Analytics",
    newChat: "Reset chat",
    settings: "Settings",
    disconnect: "Disconnect",
    legalPrivacy: "Privacy",
    legalTerms: "Terms",
    legalCookies: "Cookies",
    supportLabel: "Support",
    chatSubtitle: "Your creator growth assistant",
    agentEmptyGreetingWithName: "Welcome back {name}, let's slay the day 💪",
    agentEmptyGreetingGeneric: "Welcome back, let's slay the day 💪",
    chipViralIdea: "Viral idea of the day",
    chipWeeklyPlan: "Weekly content plan",
    chipMotivate: "Motivate me",
    chipPostIdeas: "Post ideas",
    chipFindVoice: "Find my voice",
    homePromptWeeklyPlan: "Build me a weekly content plan for this week based on my latest posts.",
    homePromptMotivate: "Give me a quick motivation boost as a creator who's feeling stuck today.",
    homePromptPostIdeas: "Give me 5 post ideas tailored to my niche and recent performance.",
    homePromptFindVoice: "Help me find my voice. What's my edge as a creator?",
    homePromptViralIdea: "Give me one viral content idea for today, tailored to my niche and audience.",
    scoreModalSectionWhat: "What is it?",
    scoreModalSectionDrivers: "What's driving your score?",
    scoreMetaMomentumName: "Momentum",
    scoreMetaMomentumWhat:
      "Your Momentum score gives you a clear pulse on your creative drive. It blends how consistently you show up with how your audience responds, so you always know if you're moving forward.",
    scoreMetaMomentumDrivers:
      'The combination of your Consistency & Growth scores, guiding you toward "Am I on track?"',
    scoreMetaConsistencyName: "Consistency",
    scoreMetaConsistencyWhat:
      "Consistency reflects your commitment to showing up and publishing. It's the rhythm that helps you build habits that compound over time.",
    scoreMetaConsistencyDrivers: "How often you post each week and how steady that cadence is over time.",
    scoreMetaGrowthName: "Growth",
    scoreMetaGrowthWhat:
      "Growth highlights the progress of your effort online. It captures how your content lands with your audience and the momentum you're building along the way.",
    scoreMetaGrowthDrivers: "Your engagement and reach trends, plus the actions you take to improve.",
    onboardConnectTitle: "Connect your Instagram to get started",
    onboardConnectSub: "So I can analyze your content and coach you personally for your audience.",
    onboardConnectInstagram: "Connect Instagram",
    onboardConnectLogout: "Log out",
    onboardScanPosts: "posts",
    onboardScanLikes: "likes",
    onboardScanReach: "reach",
    onboardScanTitle: "Scanning your profile...",
    onboardScanStep1: "Analyzing posts",
    onboardScanStep2: "Reading captions",
    onboardScanStep3: "Measuring reach",
    onboardScanStep4: "Finding your edge",
    onboardEdgeTitleSuffix: ", you've got an edge",
    onboardEdgeSuperKicker: "🔥 Your Superpower",
    onboardEdgeUnlockKicker: "🚀 Your Unlock",
    onboardEdgeSuperLine1: "What you're",
    onboardEdgeSuperLine2: "crushing",
    onboardEdgeUnlockLine1: "Your untapped",
    onboardEdgeUnlockLine2: "potential",
    onboardEdgeCta: "Continue",
    onboardPaymentTitle: "Activate your plan",
    onboardPaymentSubtitle: "Subscribe to unlock the AI coach and analytics.",
    onboardPaymentPlanName: "Monthly",
    onboardPaymentPeriod: "/mo",
    onboardPaymentPerkCancel: "Cancel anytime",
    onboardPaymentPerkMoney: "30-day money-back guarantee",
    onboardPaymentCta: "Continue to checkout",
    onboardPaymentLoggedInAs: "Logged in as:",
    chatInputPlaceholder: "Message PostPilot Agent",
    suggestionsLabel: "Suggestions",
    suggestions: [
      { icon: "📊", label: "Analyze performance", prompt: "Analyze my latest performance and tell me what to improve" },
      { icon: "✏️", label: "Generate post draft", prompt: "Write a post draft based on my niche and recent best-performing content" },
      { icon: "📅", label: "Weekly content plan", prompt: "Create my weekly content plan with specific post ideas for each day" },
      { icon: "♻️", label: "Repurpose a post", prompt: "Take my best performing post and repurpose it into 3 different formats" },
      { icon: "💬", label: "Caption ideas", prompt: "Give me 5 engaging caption ideas based on my niche and audience" },
      { icon: "🚀", label: "Growth tips", prompt: "What are the top 3 things I should change to grow faster on social media?" },
    ],
    analyticsTotalPosts: "Total posts",
    analyticsTotalLikes: "Total likes",
    analyticsTotalComments: "Total comments",
    analyticsTotalImpressions: "Total impressions",
    analyticsAvgEngagement: "Avg engagement / post",
    analyticsEngagementTrend: "Engagement over time",
    analyticsPerformanceByType: "Performance by content type",
    analyticsBestDay: "Best day to post",
    analyticsCaptionLength: "Caption length vs engagement",
    analyticsTopPosts: "Top posts by engagement",
    chartLikes: "Likes",
    chartComments: "Comments",
    chartImpressions: "Impressions",
    chartPosts: "Posts",
    chartAvgEngagement: "Avg engagement",
    chartCaptionLengthAxis: "Caption length (chars)",
    chartEngagementAxis: "Engagement",
    chartAvgEngShort: "Avg eng.",
    msgSenderAssistant: "PostPilot",
    msgSenderUser: "You",
    send: "Send",
    saveSettings: "Save settings",
    onboardingRequired: "Complete onboarding when you are ready. I need those details before I can coach your content.",
    disconnectToast: "Disconnected. Sign in again when you are ready.",
    disconnectConfirmTitle: "Disconnect account?",
    disconnectConfirmBody: "You will be signed out and returned to the home screen.",
    disconnectConfirmCancel: "Cancel",
    disconnectConfirmCta: "Disconnect",
    newChatStarted: "New chat started. Ask for drafts, analytics, repurposing, or a weekly plan.",
    onboardingDone: "Onboarding complete. I am ready to coach your content strategy.",
    settingsSaved: "Settings saved. I refreshed your account profile and content sources.",
    initialAssistant: "I am your AI content agent. Complete onboarding, then ask for drafts, analytics, weekly plans, or repurposing.",
    signInModalTitle: "Sign In to PostPilot",
    signInSubmit: "Sign in",
    signinPasswordPh: "Enter your password",
    signupPhFullName: "Enter your full name",
    signupPhEmail: "you@example.com",
    signupPhPassword: "Create a password",
    accountPhName: "Your name",
    accountPhEmail: "you@domain.com",
    onboardingCreateTitle: "Create your account",
    onboardingCreateSubtitle: "Set up your creator profile to unlock your AI agent.",
    onboardingFormTitle: "Complete onboarding",
    onboardingFormSubtitle:
      "Tell us about your niche and main objective. You can connect LinkedIn and Instagram later in Settings.",
    onboardPhNiche: "e.g. creator education for coaches",
    onboardPhObjective: "e.g. grow inbound leads from content",
    shortName: "Name",
    shortEmail: "Email",
    nicheLabel: "Niche",
    objectiveShort: "Objective",
    onboardObjectiveLabel: "Main objective",
    linkedinUsername: "LinkedIn username",
    instagramUsername: "Instagram username",
    completeOnboarding: "Complete onboarding",
    settingsModalHeading: "Settings",
    tabGeneral: "General",
    tabAccount: "Account",
    tabConnections: "Connections",
    tabSupport: "Support",
    panelGeneral: "General",
    panelAccount: "Account",
    panelConnections: "Connections",
    panelSupport: "Support",
    settingsLegalTitle: "Legal",
    settingsLegalHint: "Privacy policy, terms of service, and cookie policy.",
    supportEmailTitle: "Support email",
    supportEmailHint: "Write us anytime for account or billing issues.",
    supportPhoneTitle: "Support phone",
    supportPhoneHint: "For urgent requests, call this number.",
    settingsNicheHint: "Your core content angle and audience.",
    settingsObjectiveHint: "Main growth outcome for this quarter.",
    onboardingKicker: "Get Started",
    paymentModeTitle: "Activate your plan",
    paymentModeSubtitle: "Complete your 29 Euro/month subscription to unlock the AI coach.",
    onboardingExplainerTitle: "What PostPilot does",
    onboardingExplainerBody: "Analyzes your content, identifies growth patterns, and gives practical weekly actions, drafts, and feedback.",
    paymentPlanLabel: "PostPilot Pro",
    paymentActivateTitle: "Activate your subscription",
    paymentPriceSuffix: " / month",
    paymentFeature1: "Full AI coaching chat access",
    paymentFeature2: "Content strategy and draft generation",
    paymentFeature3: "Weekly planning and performance insights",
    paymentAgree: "I agree to start a monthly 29 Euro subscription.",
    paymentSubmit: "Complete payment",
    paymentRequiredBeforeContinuing: "Payment is required before continuing.",
    paymentCompleteToContinue: "Complete payment to continue.",
    paymentEndpointUnavailable: "Payment endpoint is unavailable. Restart the server and try again.",
    onboardingMissingFields: "Complete niche and objective to continue.",
    paymentConfirmTerms: "Please confirm the subscription terms.",
    paymentCheckoutSessionError: "Could not create Stripe checkout session.",
    checkoutCanceled: "Checkout was canceled. Complete payment to unlock the AI coach.",
    checkoutProcessing: "Payment processing complete. Verifying subscription...",
    googleConnected: "Connected with Google.",
    connectAccount: "Connect account",
    reconnectAccount: "Reconnect account",
    connectedViaOauth: "Connected via OAuth",
    notConnected: "Not connected",
    integrationRedirecting: "Redirecting to secure authorization...",
    integrationAuthUrlMissing: "Authorization URL missing.",
    integrationConnectFailedPrefix: "Could not start account connection",
    integrationConnectedToast: "{platform} connected successfully.",
    integrationConnectErrorToast: "Could not connect {platform}: {error}",
    disconnectIntegrationBtn: "Disconnect",
    disconnectIntegrationConfirmTitle: "Disconnect {platform}?",
    disconnectIntegrationConfirmBody: "You will be signed out of {platform}. You can reconnect later, but only with the same @{username} account.",
    integrationLockedNote: "This profile is permanently linked to @{username}. You can only reconnect using the same account.",
    integrationAccountMismatch: "Could not connect {platform}: this profile is linked to @{username}. Please reconnect using that account.",
    disconnectedToast: "{platform} has been disconnected.",
  },
  ro: {
    language: "Limba",
    heroBadge: "Acces Timpuriu - Oferta Limitata",
    heroTitleMain: "Creste-ti comunitatea.",
    heroTitleAccent: "Cu propriul tau coach AI.",
    heroSubtitle: "Primeste zilnic idei virale personalizate si increderea de a le publica.",
    signal1: "Prompturi personalizate zilnic",
    signal2: "Feedback adaptat vocii tale",
    signal3: "Fara fluff. Doar claritate.",
    socialProofTitle: "Creatorii iubesc PostPilot",
    socialProofSubtitle: "Alatura-te miilor care si-au gasit increderea creativa",
    testimonial1Quote: "\"Mi-a analizat Instagramul si mi-a spus exact ce vede audienta mea.\"",
    testimonial1Role: "Coach de libertate si scop",
    testimonial2Quote: "\"Mi-a redat increderea in vocea mea - de parca in sfarsit stiam ce sa spun.\"",
    testimonial2Role: "Coach de viata si fitness",
    testimonial3Quote: "\"Mi-a spus adevarul - fara vorbe goale, fara laude false. Exact ce aveam nevoie.\"",
    testimonial3Role: "Coach de sanatate si wellness",
    achieveTitle: "Ce vei obtine",
    achieveSubtitle: "PostPilot nu iti ofera doar idei. Iti transforma modul de a crea.",
    feature1Title: "Creste-ti audienta mai rapid",
    feature1Text: "Continut constant si de calitate, care rezoneaza cu urmaritorii tai ideali",
    feature2Title: "Gaseste-ti ritmul creativ",
    feature2Text: "Descopera ce functioneaza pentru tine si transforma in stilul tau semnatura",
    feature3Title: "Apari cu incredere, zi de zi",
    feature3Text: "Fara sa mai supraanalizezi sau sa te indoiesti de continutul tau",
    feature4Title: "Transforma postarea din corvoada in obicei",
    feature4Text: "Fa crearea continutului sa para naturala, nu fortata",
    comingSoonBadge: "In curand",
    comingSoonTitle: "Acesta este doar inceputul",
    comingSoonSubtitle: "Pregatim functii noi si interesante.",
    chip1: "Editor video cu AI",
    chip2: "Panou cu analize si indicatori",
    chip3: "Generator de carusele",
    chip4: "Programator zilnic de continut",
    chip5: "Banca de idei de continut",
    finalCtaTitle: "Nu ai nevoie de inca un tool de continut.",
    finalCtaSubtitle: "Ai nevoie de un coach care te ajuta sa crezi in ideile tale.",
    finalCtaClosing: "Acesta este PostPilot.",
    finalCtaGuarantee: "",
    finalLegalNote: "PostPilot Labs 2026 - Construit pentru creatorii independenti.",
    signupTitle: "Incearca PostPilot",
    continueGoogle: "Continua cu Google",
    or: "sau",
    fullName: "Nume complet",
    emailAddress: "Adresa de email",
    password: "Parola",
    tipsOptIn: "Trimite-mi sfaturi pentru creatori si alte oportunitati",
    createAccount: "Creeaza cont",
    guarantee1: "",
    guarantee2: "",
    alreadyAccount: "Ai deja cont?",
    signIn: "Autentificare",
    agentView: "Agent",
    analyticsView: "Analize",
    newChat: "Reset chat",
    settings: "Setari",
    disconnect: "Deconectare",
    legalPrivacy: "Confidentialitate",
    legalTerms: "Termeni",
    legalCookies: "Cookie-uri",
    supportLabel: "Suport",
    chatSubtitle: "Asistentul tau pentru crestere",
    agentEmptyGreetingWithName: "Bine ai revenit, {name}, hai sa rupem ziua asta 💪",
    agentEmptyGreetingGeneric: "Bine ai revenit, hai sa rupem ziua asta 💪",
    chipViralIdea: "Ideea virala a zilei",
    chipWeeklyPlan: "Plan de continut saptamanal",
    chipMotivate: "Motivaza-ma",
    chipPostIdeas: "Idei de postari",
    chipFindVoice: "Gaseste-mi vocea",
    homePromptWeeklyPlan:
      "Fa-mi un plan de continut pentru saptamana asta, pe baza ultimelor mele postari.",
    homePromptMotivate:
      "Da-mi un boost rapid de motivatie ca un creator care se simte blocat azi.",
    homePromptPostIdeas:
      "Da-mi 5 idei de postari adaptate nisei mele si performantei recente.",
    homePromptFindVoice:
      "Ajuta-ma sa imi gasesc vocea. Care e atuul meu ca si creator?",
    homePromptViralIdea:
      "Da-mi o idee virala de continut pentru azi, adaptata nisei si audientei mele.",
    scoreModalSectionWhat: "Ce inseamna?",
    scoreModalSectionDrivers: "Ce influenteaza scorul tau?",
    scoreMetaMomentumName: "Momentum",
    scoreMetaMomentumWhat:
      "Scorul de Momentum iti arata cat de activ esti creativ. Combina cat de constant postezi cu felul in care reactioneaza audienta, ca sa stii daca mergi inainte.",
    scoreMetaMomentumDrivers:
      "Combinatia scorurilor de Consistenta si Crestere — raspunsul la intrebarea «Sunt pe drumul bun?»",
    scoreMetaConsistencyName: "Consistenta",
    scoreMetaConsistencyWhat:
      "Consistenta reflecta angajamentul tau de a aparea si publica. Este ritmul care te ajuta sa construiesti obiceiuri care se acumuleaza in timp.",
    scoreMetaConsistencyDrivers:
      "Cat de des postezi pe saptamana si cat de stabil ramane acest ritm in timp.",
    scoreMetaGrowthName: "Crestere",
    scoreMetaGrowthWhat:
      "Cresterea pune in lumina progresul tau online. Arata cum prinde continutul la public si ce impuls construiesti.",
    scoreMetaGrowthDrivers:
      "Trendurile de engagement si reach, plus actiunile pe care le iei ca sa imbunatatesti.",
    onboardConnectTitle: "Conecteaza Instagram ca sa incepi",
    onboardConnectSub:
      "Ca sa analizez continutul tau si sa te coachuiesc personal pentru audienta ta.",
    onboardConnectInstagram: "Conecteaza Instagram",
    onboardConnectLogout: "Deconectare",
    onboardScanPosts: "postari",
    onboardScanLikes: "aprecieri",
    onboardScanReach: "reach",
    onboardScanTitle: "Iti scanam profilul...",
    onboardScanStep1: "Analizam postarile",
    onboardScanStep2: "Citim descrierile",
    onboardScanStep3: "Masuram reach-ul",
    onboardScanStep4: "Iti gasim atuul",
    onboardEdgeTitleSuffix: ", ai un atuu",
    onboardEdgeSuperKicker: "🔥 Superputerea ta",
    onboardEdgeUnlockKicker: "🚀 Potentialul tau",
    onboardEdgeSuperLine1: "Ce",
    onboardEdgeSuperLine2: "reusesti",
    onboardEdgeUnlockLine1: "Potentialul",
    onboardEdgeUnlockLine2: "nefolosit",
    onboardEdgeCta: "Continua",
    onboardPaymentTitle: "Activeaza-ti planul",
    onboardPaymentSubtitle: "Aboneaza-te ca sa deblochezi coach-ul AI si analizele complete.",
    onboardPaymentPlanName: "Lunar",
    onboardPaymentPeriod: "/luna",
    onboardPaymentPerkCancel: "Anuleaza oricand",
    onboardPaymentPerkMoney: "Garantie returnare bani 30 zile",
    onboardPaymentCta: "Continua catre plata",
    onboardPaymentLoggedInAs: "Autentificat ca:",
    chatInputPlaceholder: "Mesaj catre PostPilot Agent",
    suggestionsLabel: "Sugestii",
    suggestions: [
      { icon: "📊", label: "Analizeaza performanta", prompt: "Analizeaza-mi ultima performanta si spune-mi ce sa imbunatatesc" },
      { icon: "✏️", label: "Genereaza draft postare", prompt: "Scrie un draft de postare bazat pe nisa mea si continutul recent cu cele mai bune rezultate" },
      { icon: "📅", label: "Plan saptamanal de continut", prompt: "Creeaza-mi planul saptamanal de continut cu idei specifice de postari pentru fiecare zi" },
      { icon: "♻️", label: "Reutilizeaza o postare", prompt: "Ia cea mai performanta postare a mea si transform-o in 3 formate diferite" },
      { icon: "💬", label: "Idei de descrieri", prompt: "Da-mi 5 idei de descrieri captivante bazate pe nisa si audienta mea" },
      { icon: "🚀", label: "Sfaturi de crestere", prompt: "Care sunt cele mai importante 3 lucruri pe care ar trebui sa le schimb ca sa cresc mai repede pe social media?" },
    ],
    analyticsTotalPosts: "Total postari",
    analyticsTotalLikes: "Total aprecieri",
    analyticsTotalComments: "Total comentarii",
    analyticsAvgEngagement: "Interactiune medie / postare",
    analyticsEngagementTrend: "Interactiuni in timp",
    analyticsPerformanceByType: "Performanta dupa tip de continut",
    analyticsBestDay: "Cea mai buna zi de postare",
    analyticsCaptionLength: "Lungime descriere vs interactiuni",
    analyticsTopPosts: "Top postari dupa interactiuni",
    chartLikes: "Aprecieri",
    chartComments: "Comentarii",
    chartPosts: "Postari",
    chartAvgEngagement: "Interactiune medie",
    chartCaptionLengthAxis: "Lungime descriere (caractere)",
    chartEngagementAxis: "Interactiuni",
    chartAvgEngShort: "Int. medie",
    msgSenderAssistant: "PostPilot",
    msgSenderUser: "Tu",
    send: "Trimite",
    saveSettings: "Salveaza setarile",
    onboardingRequired: "Completeaza onboarding-ul cand esti pregatit. Am nevoie de aceste detalii inainte sa te pot ajuta.",
    disconnectToast: "Deconectat. Autentifica-te din nou cand esti pregatit.",
    disconnectConfirmTitle: "Confirmi deconectarea?",
    disconnectConfirmBody: "Vei fi deconectat si trimis inapoi la ecranul principal.",
    disconnectConfirmCancel: "Anuleaza",
    disconnectConfirmCta: "Deconectare",
    newChatStarted: "Chat nou pornit. Cere drafturi, analize, reutilizare sau un plan saptamanal.",
    onboardingDone: "Onboarding finalizat. Sunt gata sa te ajut cu strategia ta de continut.",
    settingsSaved: "Setarile au fost salvate. Am actualizat profilul si sursele tale de continut.",
    initialAssistant: "Sunt agentul tau AI de continut. Completeaza onboarding-ul, apoi cere drafturi, analize sau planuri saptamanale.",
    signInModalTitle: "Autentificare PostPilot",
    signInSubmit: "Intra in cont",
    signinPasswordPh: "Introdu parola",
    signupPhFullName: "Introdu numele complet",
    signupPhEmail: "exemplu@email.com",
    signupPhPassword: "Creeaza o parola",
    accountPhName: "Numele tau",
    accountPhEmail: "tu@domeniu.com",
    onboardingCreateTitle: "Creeaza contul",
    onboardingCreateSubtitle: "Configureaza profilul de creator ca sa activezi agentul AI.",
    onboardingFormTitle: "Finalizeaza onboarding-ul",
    onboardingFormSubtitle:
      "Spune-ne despre nisa si obiectivul principal. Poti conecta LinkedIn si Instagram mai tarziu din Setari.",
    onboardPhNiche: "ex: educatie pentru creatori si coachi",
    onboardPhObjective: "ex: crestere lead-uri din continut",
    shortName: "Nume",
    shortEmail: "Email",
    nicheLabel: "Nisa",
    objectiveShort: "Obiectiv",
    onboardObjectiveLabel: "Obiectiv principal",
    linkedinUsername: "Utilizator LinkedIn",
    instagramUsername: "Utilizator Instagram",
    completeOnboarding: "Finalizeaza onboarding-ul",
    settingsModalHeading: "Setari",
    tabGeneral: "General",
    tabAccount: "Cont",
    tabConnections: "Conexiuni",
    tabSupport: "Suport",
    panelGeneral: "General",
    panelAccount: "Cont",
    panelConnections: "Conexiuni",
    panelSupport: "Suport",
    settingsLegalTitle: "Legal",
    settingsLegalHint: "Politica de confidentialitate, termeni si politica de cookie-uri.",
    supportEmailTitle: "Email suport",
    supportEmailHint: "Scrie-ne oricand pentru probleme de cont sau facturare.",
    supportPhoneTitle: "Telefon suport",
    supportPhoneHint: "Pentru solicitari urgente, suna la acest numar.",
    settingsNicheHint: "Unghiul tau de continut si publicul tinta.",
    settingsObjectiveHint: "Rezultatul principal de crestere pentru acest trimestru.",
    onboardingKicker: "Incepe acum",
    paymentModeTitle: "Activeaza-ti planul",
    paymentModeSubtitle: "Finalizeaza abonamentul de 29 Euro/luna ca sa deblochezi coach-ul AI.",
    onboardingExplainerTitle: "Ce face PostPilot",
    onboardingExplainerBody: "Analizeaza continutul tau, identifica tipare de crestere si ofera actiuni practice saptamanale, drafturi si feedback.",
    paymentPlanLabel: "PostPilot Pro",
    paymentActivateTitle: "Activeaza abonamentul",
    paymentPriceSuffix: " / luna",
    paymentFeature1: "Acces complet la chat-ul AI de coaching",
    paymentFeature2: "Strategie de continut si generare de drafturi",
    paymentFeature3: "Planificare saptamanala si insight-uri de performanta",
    paymentAgree: "Sunt de acord sa pornesc un abonament lunar de 29 Euro.",
    paymentSubmit: "Finalizeaza plata",
    paymentRequiredBeforeContinuing: "Plata este necesara inainte de a continua.",
    paymentCompleteToContinue: "Finalizeaza plata pentru a continua.",
    paymentEndpointUnavailable: "Endpoint-ul de plata nu este disponibil. Reporneste serverul si incearca din nou.",
    onboardingMissingFields: "Completeaza nisa si obiectivul pentru a continua.",
    paymentConfirmTerms: "Te rog confirma termenii abonamentului.",
    paymentCheckoutSessionError: "Nu am putut crea sesiunea Stripe Checkout.",
    checkoutCanceled: "Checkout-ul a fost anulat. Finalizeaza plata pentru a debloca AI coach-ul.",
    checkoutProcessing: "Plata a fost trimisa. Verificam abonamentul...",
    googleConnected: "Conectat cu Google.",
    connectAccount: "Conecteaza contul",
    reconnectAccount: "Reconecteaza contul",
    connectedViaOauth: "Conectat prin OAuth",
    notConnected: "Neconectat",
    integrationRedirecting: "Redirectionare catre autorizarea securizata...",
    integrationAuthUrlMissing: "Lipseste URL-ul de autorizare.",
    integrationConnectFailedPrefix: "Nu am putut porni conectarea contului",
    integrationConnectedToast: "{platform} a fost conectat cu succes.",
    integrationConnectErrorToast: "Nu am putut conecta {platform}: {error}",
    disconnectIntegrationBtn: "Deconecteaza",
    disconnectIntegrationConfirmTitle: "Deconectezi {platform}?",
    disconnectIntegrationConfirmBody: "Vei fi deconectat de la {platform}. Poti reconecta mai tarziu, dar doar cu acelasi cont @{username}.",
    integrationLockedNote: "Acest profil este legat permanent de @{username}. Te poti reconecta doar cu acelasi cont.",
    integrationAccountMismatch: "Nu am putut conecta {platform}: acest profil este legat de @{username}. Te rog foloseste acelasi cont.",
    disconnectedToast: "{platform} a fost deconectat.",
  },
  it: {
    language: "Lingua",
    heroBadge: "Accesso Anticipato - Offerta Limitata",
    heroTitleMain: "Fai crescere il tuo pubblico.",
    heroTitleAccent: "Con il tuo coach AI personale.",
    heroSubtitle: "Ricevi ogni giorno idee virali personalizzate e la fiducia per pubblicarle.",
    signal1: "Prompt personalizzati ogni giorno",
    signal2: "Feedback adatto alla tua voce",
    signal3: "Niente fuffa. Solo chiarezza.",
    socialProofTitle: "I creator amano PostPilot",
    socialProofSubtitle: "Unisciti a migliaia di creator che hanno ritrovato fiducia",
    testimonial1Quote: "\"Ha davvero analizzato il mio Instagram e mi ha detto cosa vede il mio pubblico.\"",
    testimonial1Role: "Coach di liberta e scopo",
    testimonial2Quote: "\"Mi ha ridato fiducia nella mia voce - finalmente sapevo cosa dire.\"",
    testimonial2Role: "Coach di vita e fitness",
    testimonial3Quote: "\"Mi ha detto la verita - niente fronzoli, niente lodi finte. Esattamente cio che mi serviva.\"",
    testimonial3Role: "Coach salute e benessere",
    achieveTitle: "Cosa otterrai",
    achieveSubtitle: "PostPilot non ti da solo idee. Trasforma il tuo modo di creare.",
    feature1Title: "Fai crescere il pubblico piu velocemente",
    feature1Text: "Contenuti costanti e di qualita che risuonano con i follower ideali",
    feature2Title: "Trova il tuo ritmo creativo",
    feature2Text: "Scopri cosa funziona per te e trasformalo nel tuo stile distintivo",
    feature3Title: "Presentati con fiducia ogni giorno",
    feature3Text: "Niente piu overthinking o dubbi continui sui contenuti",
    feature4Title: "Trasforma il postare da fatica ad abitudine",
    feature4Text: "Rendi la creazione di contenuti naturale, non forzata",
    comingSoonBadge: "In arrivo",
    comingSoonTitle: "Questo e solo l'inizio",
    comingSoonSubtitle: "Abbiamo nuove funzionalita entusiasmanti in arrivo.",
    chip1: "Editor video con AI",
    chip2: "Pannello analisi e metriche",
    chip3: "Generatore di caroselli",
    chip4: "Scheduler giornaliero contenuti",
    chip5: "Archivio idee contenuti",
    finalCtaTitle: "Non ti serve un altro tool per contenuti.",
    finalCtaSubtitle: "Ti serve un coach che ti aiuti a credere nelle tue idee.",
    finalCtaClosing: "Questo e PostPilot.",
    finalCtaGuarantee: "",
    finalLegalNote: "PostPilot Labs 2026 - Creato per creator indipendenti.",
    signupTitle: "Prova PostPilot",
    continueGoogle: "Continua con Google",
    or: "oppure",
    fullName: "Nome completo",
    emailAddress: "Indirizzo email",
    password: "Password",
    tipsOptIn: "Inviami consigli per creator e altre opportunita",
    createAccount: "Crea account",
    guarantee1: "",
    guarantee2: "",
    alreadyAccount: "Hai gia un account?",
    signIn: "Accedi",
    newChat: "Reset chat",
    settings: "Impostazioni",
    disconnect: "Disconnetti",
    legalPrivacy: "Privacy",
    legalTerms: "Termini",
    legalCookies: "Cookie",
    supportLabel: "Supporto",
    chatSubtitle: "Il tuo assistente per la crescita creator",
    agentEmptyGreetingWithName: "Bentornato {name}, facciamo brillare questa giornata 💪",
    agentEmptyGreetingGeneric: "Bentornato, facciamo brillare questa giornata 💪",
    chipViralIdea: "Idea virale del giorno",
    chipWeeklyPlan: "Piano contenuti settimanale",
    chipMotivate: "Motivami",
    chipPostIdeas: "Idee per post",
    chipFindVoice: "Trova la mia voce",
    homePromptWeeklyPlan:
      "Creami un piano di contenuti per questa settimana in base alle mie ultime pubblicazioni.",
    homePromptMotivate:
      "Dammi una spinta motivazionale veloce come creator che oggi si sente bloccato.",
    homePromptPostIdeas:
      "Dammi 5 idee per post adatte alla mia nicchia e alle performance recenti.",
    homePromptFindVoice:
      "Aiutami a trovare la mia voce. Qual e il mio punto di forza come creator?",
    homePromptViralIdea:
      "Dammi un'idea di contenuto virale per oggi, adatta alla mia nicchia e al mio pubblico.",
    scoreModalSectionWhat: "Cos'e?",
    scoreModalSectionDrivers: "Cosa muove il tuo punteggio?",
    scoreMetaMomentumName: "Momentum",
    scoreMetaMomentumWhat:
      "Il punteggio Momentum misura la tua spinta creativa. Unisce quanto sei costante a come reagisce il pubblico, cosi sai se stai avanzando.",
    scoreMetaMomentumDrivers:
      "La combinazione dei punteggi Coerenza e Crescita: ti aiuta a capire «Sono sulla strada giusta?»",
    scoreMetaConsistencyName: "Coerenza",
    scoreMetaConsistencyWhat:
      "La coerenza riflette quanto ti impegni a pubblicare. E il ritmo che ti aiuta a creare abitudini che si accumulano nel tempo.",
    scoreMetaConsistencyDrivers:
      "Quanto spesso posti a settimana e quanto e stabile quel ritmo nel tempo.",
    scoreMetaGrowthName: "Crescita",
    scoreMetaGrowthWhat:
      "La crescita mette in luce i progressi online. Mostra come il contenuto arriva al pubblico e che slancio stai costruendo.",
    scoreMetaGrowthDrivers: "Tendenze di engagement e reach, piu le azioni che fai per migliorare.",
    onboardConnectTitle: "Collega Instagram per iniziare",
    onboardConnectSub:
      "Così posso analizzare i tuoi contenuti e accompagnarti in modo personalizzato per il tuo pubblico.",
    onboardConnectInstagram: "Collega Instagram",
    onboardConnectLogout: "Esci",
    onboardScanPosts: "post",
    onboardScanLikes: "like",
    onboardScanReach: "reach",
    onboardScanTitle: "Scansione del profilo...",
    onboardScanStep1: "Analisi dei post",
    onboardScanStep2: "Lettura delle didascalie",
    onboardScanStep3: "Misurazione della reach",
    onboardScanStep4: "Alla ricerca del tuo vantaggio",
    onboardEdgeTitleSuffix: ", hai un vantaggio",
    onboardEdgeSuperKicker: "🔥 Il tuo superpotere",
    onboardEdgeUnlockKicker: "🚀 Il tuo potenziale",
    onboardEdgeSuperLine1: "Cosa stai",
    onboardEdgeSuperLine2: "dominando",
    onboardEdgeUnlockLine1: "Il potenziale",
    onboardEdgeUnlockLine2: "in espansione",
    onboardEdgeCta: "Continua",
    onboardPaymentTitle: "Attiva il tuo piano",
    onboardPaymentSubtitle: "Abbonati per sbloccare il coach IA e le analisi complete.",
    onboardPaymentPlanName: "Mensile",
    onboardPaymentPeriod: "/mese",
    onboardPaymentPerkCancel: "Cancella quando vuoi",
    onboardPaymentPerkMoney: "Garanzia soddisfatti o rimborsati 30 giorni",
    onboardPaymentCta: "Vai al checkout",
    onboardPaymentLoggedInAs: "Accesso come:",
    chatInputPlaceholder: "Messaggio per PostPilot Agent",
    suggestionsLabel: "Suggerimenti",
    suggestions: [
      { icon: "📊", label: "Analizza le performance", prompt: "Analizza le mie ultime performance e dimmi cosa migliorare" },
      { icon: "✏️", label: "Genera bozza post", prompt: "Scrivi una bozza di post basata sulla mia nicchia e sui contenuti recenti piu performanti" },
      { icon: "📅", label: "Piano settimanale contenuti", prompt: "Crea il mio piano settimanale di contenuti con idee specifiche per ogni giorno" },
      { icon: "♻️", label: "Riutilizza un post", prompt: "Prendi il mio post piu performante e trasformalo in 3 formati diversi" },
      { icon: "💬", label: "Idee per descrizioni", prompt: "Dammi 5 idee di descrizioni coinvolgenti basate sulla mia nicchia e il mio pubblico" },
      { icon: "🚀", label: "Consigli di crescita", prompt: "Quali sono le 3 cose principali che dovrei cambiare per crescere piu velocemente sui social?" },
    ],
    analyticsTotalPosts: "Post totali",
    analyticsTotalLikes: "Like totali",
    analyticsTotalComments: "Commenti totali",
    analyticsAvgEngagement: "Interazione media / post",
    analyticsEngagementTrend: "Interazioni nel tempo",
    analyticsPerformanceByType: "Performance per tipo di contenuto",
    analyticsBestDay: "Giorno migliore per postare",
    analyticsCaptionLength: "Lunghezza descrizione vs interazioni",
    analyticsTopPosts: "Top post per interazioni",
    chartLikes: "Like",
    chartComments: "Commenti",
    chartPosts: "Post",
    chartAvgEngagement: "Interazione media",
    chartCaptionLengthAxis: "Lunghezza descrizione (caratteri)",
    chartEngagementAxis: "Interazioni",
    chartAvgEngShort: "Int. media",
    msgSenderAssistant: "PostPilot",
    msgSenderUser: "Tu",
    send: "Invia",
    saveSettings: "Salva impostazioni",
    onboardingRequired: "Completa l'onboarding quando vuoi. Mi servono questi dettagli prima di aiutarti.",
    disconnectToast: "Disconnesso. Accedi di nuovo quando vuoi.",
    disconnectConfirmTitle: "Confermi la disconnessione?",
    disconnectConfirmBody: "Verrai disconnesso e riportato alla schermata principale.",
    disconnectConfirmCancel: "Annulla",
    disconnectConfirmCta: "Disconnetti",
    newChatStarted: "Nuova chat avviata. Chiedi bozze, analisi, repurposing o un piano settimanale.",
    onboardingDone: "Onboarding completato. Sono pronto ad aiutarti con la tua strategia contenuti.",
    settingsSaved: "Impostazioni salvate. Ho aggiornato il profilo e le fonti contenuto.",
    initialAssistant: "Sono il tuo agente AI per i contenuti. Completa l'onboarding e poi chiedi bozze, analisi o piani settimanali.",
    signInModalTitle: "Accedi a PostPilot",
    signInSubmit: "Accedi",
    signinPasswordPh: "Inserisci la password",
    signupPhFullName: "Inserisci il nome completo",
    signupPhEmail: "tu@esempio.com",
    signupPhPassword: "Crea una password",
    accountPhName: "Il tuo nome",
    accountPhEmail: "tu@dominio.com",
    onboardingCreateTitle: "Crea il tuo account",
    onboardingCreateSubtitle: "Imposta il profilo creator per sbloccare l'agente AI.",
    onboardingFormTitle: "Completa l'onboarding",
    onboardingFormSubtitle:
      "Parlaci di nicchia e obiettivo principale. Puoi collegare LinkedIn e Instagram piu tardi in Impostazioni.",
    onboardPhNiche: "es. educazione creator per coach",
    onboardPhObjective: "es. aumentare i lead dal contenuto",
    shortName: "Nome",
    shortEmail: "Email",
    nicheLabel: "Nicchia",
    objectiveShort: "Obiettivo",
    onboardObjectiveLabel: "Obiettivo principale",
    linkedinUsername: "Username LinkedIn",
    instagramUsername: "Username Instagram",
    completeOnboarding: "Completa onboarding",
    settingsModalHeading: "Impostazioni",
    tabGeneral: "Generale",
    tabAccount: "Account",
    tabConnections: "Connessioni",
    tabSupport: "Supporto",
    panelGeneral: "Generale",
    panelAccount: "Account",
    panelConnections: "Connessioni",
    panelSupport: "Supporto",
    settingsLegalTitle: "Legale",
    settingsLegalHint: "Privacy, termini di servizio e cookie policy.",
    supportEmailTitle: "Email supporto",
    supportEmailHint: "Scrivici in qualsiasi momento per problemi account o fatturazione.",
    supportPhoneTitle: "Telefono supporto",
    supportPhoneHint: "Per richieste urgenti, chiama questo numero.",
    settingsNicheHint: "Angolo dei contenuti e pubblico di riferimento.",
    settingsObjectiveHint: "Risultato di crescita principale per questo trimestre.",
    onboardingKicker: "Inizia ora",
    paymentModeTitle: "Attiva il tuo piano",
    paymentModeSubtitle: "Completa l'abbonamento da 29 Euro/mese per sbloccare il coach AI.",
    onboardingExplainerTitle: "Cosa fa PostPilot",
    onboardingExplainerBody: "Analizza i tuoi contenuti, identifica pattern di crescita e offre azioni pratiche settimanali, bozze e feedback.",
    paymentPlanLabel: "PostPilot Pro",
    paymentActivateTitle: "Attiva il tuo abbonamento",
    paymentPriceSuffix: " / mese",
    paymentFeature1: "Accesso completo alla chat di coaching AI",
    paymentFeature2: "Strategia contenuti e generazione bozze",
    paymentFeature3: "Pianificazione settimanale e insight sulle performance",
    paymentAgree: "Accetto di avviare un abbonamento mensile da 29 Euro.",
    paymentSubmit: "Completa pagamento",
    paymentRequiredBeforeContinuing: "Il pagamento e richiesto prima di continuare.",
    paymentCompleteToContinue: "Completa il pagamento per continuare.",
    paymentEndpointUnavailable: "Endpoint di pagamento non disponibile. Riavvia il server e riprova.",
    onboardingMissingFields: "Completa nicchia e obiettivo per continuare.",
    paymentConfirmTerms: "Conferma i termini dell'abbonamento.",
    paymentCheckoutSessionError: "Impossibile creare la sessione Stripe Checkout.",
    checkoutCanceled: "Checkout annullato. Completa il pagamento per sbloccare il coach AI.",
    checkoutProcessing: "Pagamento inviato. Verifica dell'abbonamento in corso...",
    googleConnected: "Connesso con Google.",
    disconnectIntegrationBtn: "Disconnetti",
    disconnectIntegrationConfirmTitle: "Disconnettere {platform}?",
    disconnectIntegrationConfirmBody: "Verrai disconnesso da {platform}. Puoi riconnetterti piu tardi, ma solo con lo stesso account @{username}.",
    integrationLockedNote: "Questo profilo e collegato in modo permanente a @{username}. Puoi riconnetterti solo con lo stesso account.",
    integrationAccountMismatch: "Impossibile connettere {platform}: questo profilo e collegato a @{username}. Usa lo stesso account.",
    disconnectedToast: "{platform} e stato disconnesso.",
  },
  de: {
    language: "Sprache",
    heroBadge: "Fruehzugang - Zeitlich begrenztes Angebot",
    heroTitleMain: "Baue deine Reichweite aus.",
    heroTitleAccent: "Mit deinem eigenen KI-Coach.",
    heroSubtitle: "Erhalte taeglich personalisierte virale Ideen und das Vertrauen, sie zu posten.",
    signal1: "Taegliche individuelle Prompts",
    signal2: "Feedback passend zu deiner Stimme",
    signal3: "Kein BlaBla. Nur Klarheit.",
    socialProofTitle: "Creator lieben PostPilot",
    socialProofSubtitle: "Schliesse dich Tausenden an, die kreatives Selbstvertrauen gefunden haben",
    testimonial1Quote: "\"Es hat sich mein Instagram wirklich angesehen und mir gesagt, was mein Publikum sieht.\"",
    testimonial1Role: "Coach fuer Freiheit und Sinn",
    testimonial2Quote: "\"Es hat mir wieder Vertrauen in meine Stimme gegeben - als wuesste ich endlich, was ich sagen soll.\"",
    testimonial2Role: "Life- und Fitness-Coach",
    testimonial3Quote: "\"Es hat mir die Wahrheit gesagt - ohne Floskeln, ohne falsches Lob. Genau das, was ich brauchte.\"",
    testimonial3Role: "Gesundheits- und Wellness-Coach",
    achieveTitle: "Was du erreichen wirst",
    achieveSubtitle: "PostPilot gibt dir nicht nur Ideen. Es veraendert, wie du Content erstellst.",
    feature1Title: "Baue dein Publikum schneller auf",
    feature1Text: "Konstanter, hochwertiger Content, der bei deinen idealen Followern ankommt",
    feature2Title: "Finde deinen kreativen Rhythmus",
    feature2Text: "Entdecke, was fuer dich funktioniert, und mache es zu deinem Signature-Style",
    feature3Title: "Zeig dich taeglich selbstbewusst",
    feature3Text: "Kein Overthinking und kein ständiges Zweifeln mehr",
    feature4Title: "Mach Posten von einer Pflicht zur Gewohnheit",
    feature4Text: "Lass Content-Erstellung natuerlich statt erzwungen wirken",
    comingSoonBadge: "Demnaechst",
    comingSoonTitle: "Das ist erst der Anfang",
    comingSoonSubtitle: "Neue spannende Funktionen sind bereits auf dem Weg.",
    chip1: "KI-Videoeditor",
    chip2: "Uebersicht zu Reichweite und Kennzahlen",
    chip3: "Karussell-Generator",
    chip4: "Taeglicher Content-Planer",
    chip5: "Content-Ideenbank",
    finalCtaTitle: "Du brauchst kein weiteres Content-Tool.",
    finalCtaSubtitle: "Du brauchst einen Coach, der dir hilft, an deine Ideen zu glauben.",
    finalCtaClosing: "Das ist PostPilot.",
    finalCtaGuarantee: "",
    finalLegalNote: "PostPilot Labs 2026 - Entwickelt fuer unabhaengige Creator.",
    signupTitle: "Probiere PostPilot",
    continueGoogle: "Mit Google fortfahren",
    or: "oder",
    fullName: "Vollstaendiger Name",
    emailAddress: "E-Mail-Adresse",
    password: "Passwort",
    tipsOptIn: "Sende mir Creator-Tipps und weitere Moeglichkeiten",
    createAccount: "Konto erstellen",
    guarantee1: "",
    guarantee2: "",
    alreadyAccount: "Du hast bereits ein Konto?",
    signIn: "Anmelden",
    newChat: "Reset chat",
    settings: "Einstellungen",
    disconnect: "Trennen",
    legalPrivacy: "Datenschutz",
    legalTerms: "AGB",
    legalCookies: "Cookies",
    supportLabel: "Support",
    chatSubtitle: "Dein Assistent fuer Creator-Wachstum",
    agentEmptyGreetingWithName: "Willkommen zurueck, {name}, lass uns den Tag rocken 💪",
    agentEmptyGreetingGeneric: "Willkommen zurueck, lass uns den Tag rocken 💪",
    chipViralIdea: "Virale Idee des Tages",
    chipWeeklyPlan: "Woechentlicher Content-Plan",
    chipMotivate: "Motiviere mich",
    chipPostIdeas: "Post-Ideen",
    chipFindVoice: "Finde meine Stimme",
    homePromptWeeklyPlan:
      "Erstelle mir einen Content-Plan fuer diese Woche basierend auf meinen neuesten Posts.",
    homePromptMotivate:
      "Gib mir einen schnellen Motivationsschub als Creator, der sich heute feststeckt.",
    homePromptPostIdeas:
      "Gib mir 5 Post-Ideen passend zu meiner Nische und meiner aktuellen Performance.",
    homePromptFindVoice:
      "Hilf mir, meine Stimme zu finden. Was ist meine Staerke als Creator?",
    homePromptViralIdea:
      "Gib mir eine virale Content-Idee fuer heute, passend zu meiner Nische und Zielgruppe.",
    scoreModalSectionWhat: "Was ist das?",
    scoreModalSectionDrivers: "Was beeinflusst deinen Score?",
    scoreMetaMomentumName: "Momentum",
    scoreMetaMomentumWhat:
      "Der Momentum-Score zeigt deine kreative Dynamik. Er verbindet, wie regelmaessig du postest, mit der Reaktion deiner Zielgruppe.",
    scoreMetaMomentumDrivers:
      "Die Kombination aus Konsistenz- und Wachstums-Score — die Antwort auf «Bin ich auf Kurs?»",
    scoreMetaConsistencyName: "Konsistenz",
    scoreMetaConsistencyWhat:
      "Konsistenz zeigt dein Engagement, sichtbar zu sein und zu veroeffentlichen. Das ist der Rhythmus fuer Gewohnheiten, die sich mit der Zeit aufbauen.",
    scoreMetaConsistencyDrivers:
      "Wie oft du pro Woche postest und wie stabil dieser Rhythmus bleibt.",
    scoreMetaGrowthName: "Wachstum",
    scoreMetaGrowthWhat:
      "Wachstum zeigt deinen Fortschritt online. Es zeigt, wie dein Content ankommt und welchen Schwung du aufbaust.",
    scoreMetaGrowthDrivers: "Engagement- und Reichweiten-Trends plus deine Schritte zur Verbesserung.",
    onboardConnectTitle: "Verbinde Instagram, um zu starten",
    onboardConnectSub:
      "So kann ich deinen Content analysieren und dich persoenlich fuer deine Zielgruppe coachen.",
    onboardConnectInstagram: "Instagram verbinden",
    onboardConnectLogout: "Abmelden",
    onboardScanPosts: "Posts",
    onboardScanLikes: "Likes",
    onboardScanReach: "Reach",
    onboardScanTitle: "Profil wird gescannt...",
    onboardScanStep1: "Posts werden analysiert",
    onboardScanStep2: "Bildunterschriften werden gelesen",
    onboardScanStep3: "Reichweite wird gemessen",
    onboardScanStep4: "Dein Vorteil wird gesucht",
    onboardEdgeTitleSuffix: ", du hast einen Vorteil",
    onboardEdgeSuperKicker: "🔥 Deine Superkraft",
    onboardEdgeUnlockKicker: "🚀 Dein Potenzial",
    onboardEdgeSuperLine1: "Was du",
    onboardEdgeSuperLine2: "richtig gut kannst",
    onboardEdgeUnlockLine1: "Ungehobenes",
    onboardEdgeUnlockLine2: "Potenzial",
    onboardEdgeCta: "Weiter",
    onboardPaymentTitle: "Plan aktivieren",
    onboardPaymentSubtitle: "Abonniere, um den KI-Coach und alle Analysen freizuschalten.",
    onboardPaymentPlanName: "Monatlich",
    onboardPaymentPeriod: "/Monat",
    onboardPaymentPerkCancel: "Jederzeit kuendbar",
    onboardPaymentPerkMoney: "30-Tage-Geld-zurueck-Garantie",
    onboardPaymentCta: "Weiter zur Kasse",
    onboardPaymentLoggedInAs: "Angemeldet als:",
    chatInputPlaceholder: "Nachricht an PostPilot Agent",
    suggestionsLabel: "Vorschlaege",
    suggestions: [
      { icon: "📊", label: "Performance analysieren", prompt: "Analysiere meine letzte Performance und sage mir, was ich verbessern soll" },
      { icon: "✏️", label: "Post-Entwurf erstellen", prompt: "Schreibe einen Post-Entwurf basierend auf meiner Nische und meinen besten Inhalten" },
      { icon: "📅", label: "Wochenplan erstellen", prompt: "Erstelle meinen woechentlichen Content-Plan mit konkreten Post-Ideen fuer jeden Tag" },
      { icon: "♻️", label: "Beitrag wiederverwerten", prompt: "Nimm meinen erfolgreichsten Beitrag und verwandle ihn in 3 verschiedene Formate" },
      { icon: "💬", label: "Beschreibungsideen", prompt: "Gib mir 5 ansprechende Beschreibungsideen basierend auf meiner Nische und Zielgruppe" },
      { icon: "🚀", label: "Wachstumstipps", prompt: "Was sind die 3 wichtigsten Dinge, die ich aendern sollte, um schneller in Social Media zu wachsen?" },
    ],
    analyticsTotalPosts: "Beitraege gesamt",
    analyticsTotalLikes: "Likes gesamt",
    analyticsTotalComments: "Kommentare gesamt",
    analyticsAvgEngagement: "Durchschn. Interaktion / Beitrag",
    analyticsEngagementTrend: "Interaktionen im Zeitverlauf",
    analyticsPerformanceByType: "Performance nach Inhaltstyp",
    analyticsBestDay: "Bester Tag zum Posten",
    analyticsCaptionLength: "Beschreibungslaenge vs Interaktion",
    analyticsTopPosts: "Top-Beitraege nach Interaktion",
    chartLikes: "Likes",
    chartComments: "Kommentare",
    chartPosts: "Beitraege",
    chartAvgEngagement: "Durchschn. Interaktion",
    chartCaptionLengthAxis: "Beschreibungslaenge (Zeichen)",
    chartEngagementAxis: "Interaktion",
    chartAvgEngShort: "Durchschn.",
    msgSenderAssistant: "PostPilot",
    msgSenderUser: "Du",
    send: "Senden",
    saveSettings: "Einstellungen speichern",
    onboardingRequired: "Schliesse das Onboarding ab, wenn du bereit bist. Ich brauche diese Angaben, bevor ich helfen kann.",
    disconnectToast: "Getrennt. Melde dich wieder an, wenn du bereit bist.",
    disconnectConfirmTitle: "Trennen bestaetigen?",
    disconnectConfirmBody: "Du wirst abgemeldet und zur Startseite zurueckgeleitet.",
    disconnectConfirmCancel: "Abbrechen",
    disconnectConfirmCta: "Trennen",
    newChatStarted: "Neuer Chat gestartet. Frage nach Entwuerfen, Analysen, Repurposing oder Wochenplan.",
    onboardingDone: "Onboarding abgeschlossen. Ich bin bereit, deine Content-Strategie zu coachen.",
    settingsSaved: "Einstellungen gespeichert. Ich habe dein Profil und deine Content-Quellen aktualisiert.",
    initialAssistant: "Ich bin dein KI-Content-Agent. Schliess das Onboarding ab und frage dann nach Entwuerfen, Analysen oder Wochenplaenen.",
    signInModalTitle: "Bei PostPilot anmelden",
    signInSubmit: "Anmelden",
    signinPasswordPh: "Passwort eingeben",
    signupPhFullName: "Vollstaendigen Namen eingeben",
    signupPhEmail: "du@beispiel.de",
    signupPhPassword: "Passwort festlegen",
    accountPhName: "Dein Name",
    accountPhEmail: "du@domain.de",
    onboardingCreateTitle: "Konto erstellen",
    onboardingCreateSubtitle: "Richte dein Creator-Profil ein, um den KI-Agenten freizuschalten.",
    onboardingFormTitle: "Onboarding abschliessen",
    onboardingFormSubtitle:
      "Erzaehl uns von deiner Nische und deinem Hauptziel. LinkedIn und Instagram kannst du spaeter unter Einstellungen verbinden.",
    onboardPhNiche: "z.B. Creator-Bildung fuer Coaches",
    onboardPhObjective: "z.B. mehr Inbound-Leads durch Content",
    shortName: "Name",
    shortEmail: "E-Mail",
    nicheLabel: "Nische",
    objectiveShort: "Ziel",
    onboardObjectiveLabel: "Hauptziel",
    linkedinUsername: "LinkedIn-Benutzername",
    instagramUsername: "Instagram-Benutzername",
    completeOnboarding: "Onboarding abschliessen",
    settingsModalHeading: "Einstellungen",
    tabGeneral: "Allgemein",
    tabAccount: "Konto",
    tabConnections: "Verbindungen",
    tabSupport: "Support",
    panelGeneral: "Allgemein",
    panelAccount: "Konto",
    panelConnections: "Verbindungen",
    panelSupport: "Support",
    settingsLegalTitle: "Rechtliches",
    settingsLegalHint: "Datenschutz, Nutzungsbedingungen und Cookie-Richtlinie.",
    supportEmailTitle: "Support E-Mail",
    supportEmailHint: "Schreib uns jederzeit bei Konto- oder Zahlungsproblemen.",
    supportPhoneTitle: "Support-Telefon",
    supportPhoneHint: "Bei dringenden Anliegen ruf diese Nummer an.",
    settingsNicheHint: "Dein Content-Fokus und deine Zielgruppe.",
    settingsObjectiveHint: "Das wichtigste Wachstumsziel fuer dieses Quartal.",
    onboardingKicker: "Loslegen",
    paymentModeTitle: "Aktiviere deinen Plan",
    paymentModeSubtitle: "Schliesse dein Abo fuer 29 Euro/Monat ab, um den KI-Coach freizuschalten.",
    onboardingExplainerTitle: "Was PostPilot macht",
    onboardingExplainerBody: "Analysiert deinen Content, erkennt Wachstumsmuster und gibt praktische woechentliche Aktionen, Entwuerfe und Feedback.",
    paymentPlanLabel: "PostPilot Pro",
    paymentActivateTitle: "Aktiviere dein Abonnement",
    paymentPriceSuffix: " / Monat",
    paymentFeature1: "Voller Zugriff auf den KI-Coaching-Chat",
    paymentFeature2: "Content-Strategie und Entwurfsgenerierung",
    paymentFeature3: "Woechentliche Planung und Performance-Insights",
    paymentAgree: "Ich stimme zu, ein monatliches Abo fuer 29 Euro zu starten.",
    paymentSubmit: "Zahlung abschliessen",
    paymentRequiredBeforeContinuing: "Eine Zahlung ist erforderlich, bevor du fortfaehrst.",
    paymentCompleteToContinue: "Schliesse die Zahlung ab, um fortzufahren.",
    paymentEndpointUnavailable: "Payment-Endpunkt ist nicht verfuegbar. Starte den Server neu und versuche es erneut.",
    onboardingMissingFields: "Bitte Nische und Ziel ausfuellen, um fortzufahren.",
    paymentConfirmTerms: "Bitte bestaetige die Abonnementbedingungen.",
    paymentCheckoutSessionError: "Stripe-Checkout-Session konnte nicht erstellt werden.",
    checkoutCanceled: "Checkout wurde abgebrochen. Schliesse die Zahlung ab, um den KI-Coach freizuschalten.",
    checkoutProcessing: "Zahlung eingegangen. Abonnement wird verifiziert...",
    googleConnected: "Mit Google verbunden.",
    disconnectIntegrationBtn: "Trennen",
    disconnectIntegrationConfirmTitle: "{platform} trennen?",
    disconnectIntegrationConfirmBody: "Du wirst von {platform} getrennt. Du kannst dich spaeter wieder verbinden, aber nur mit demselben Konto @{username}.",
    integrationLockedNote: "Dieses Profil ist dauerhaft mit @{username} verbunden. Du kannst dich nur mit demselben Konto erneut verbinden.",
    integrationAccountMismatch: "{platform} konnte nicht verbunden werden: Dieses Profil gehoert zu @{username}. Bitte verwende dasselbe Konto.",
    disconnectedToast: "{platform} wurde getrennt.",
  },
  fr: {
    language: "Langue",
    heroBadge: "Acces Anticipe - Offre Limitee",
    heroTitleMain: "Developpez votre audience.",
    heroTitleAccent: "Avec votre coach IA personnel.",
    heroSubtitle: "Recevez chaque jour une idee virale personnalisee et la confiance pour la publier.",
    signal1: "Prompts personnalises chaque jour",
    signal2: "Feedback adapte a votre voix",
    signal3: "Sans blabla. Juste de la clarte.",
    socialProofTitle: "Les createurs adorent PostPilot",
    socialProofSubtitle: "Rejoignez des milliers de createurs qui ont retrouve leur confiance",
    testimonial1Quote: "\"Il a vraiment analyse mon Instagram et m'a dit ce que mon audience voyait.\"",
    testimonial1Role: "Coach liberte et mission",
    testimonial2Quote: "\"Il m'a redonne confiance en ma voix - comme si je savais enfin quoi dire.\"",
    testimonial2Role: "Coach vie et fitness",
    testimonial3Quote: "\"Il m'a dit la verite - sans blabla, sans faux compliments. Exactement ce qu'il me fallait.\"",
    testimonial3Role: "Coach sante et bien-etre",
    achieveTitle: "Ce que vous allez accomplir",
    achieveSubtitle: "PostPilot ne vous donne pas seulement des idees. Il transforme votre facon de creer.",
    feature1Title: "Developpez votre audience plus vite",
    feature1Text: "Un contenu regulier et de qualite qui parle a vos abonnes ideaux",
    feature2Title: "Trouvez votre rythme creatif",
    feature2Text: "Decouvrez ce qui fonctionne pour vous et transformez-le en style signature",
    feature3Title: "Soyez present avec confiance chaque jour",
    feature3Text: "Fini le surmenage mental et les doutes constants sur votre contenu",
    feature4Title: "Transformez la publication en habitude",
    feature4Text: "Rendez la creation de contenu naturelle, pas forcee",
    comingSoonBadge: "Bientot",
    comingSoonTitle: "Ce n'est que le debut",
    comingSoonSubtitle: "De nouvelles fonctionnalites passionnantes arrivent.",
    chip1: "Editeur video IA",
    chip2: "Tableau des performances et indicateurs",
    chip3: "Generateur de carrousels",
    chip4: "Planificateur quotidien de contenu",
    chip5: "Bibliotheque d'idees de contenu",
    finalCtaTitle: "Vous n'avez pas besoin d'un autre outil de contenu.",
    finalCtaSubtitle: "Vous avez besoin d'un coach qui vous aide a croire en vos idees.",
    finalCtaClosing: "C'est PostPilot.",
    finalCtaGuarantee: "",
    finalLegalNote: "PostPilot Labs 2026 - Concu pour les createurs independants.",
    signupTitle: "Essayez PostPilot",
    continueGoogle: "Continuer avec Google",
    or: "ou",
    fullName: "Nom complet",
    emailAddress: "Adresse e-mail",
    password: "Mot de passe",
    tipsOptIn: "Envoyez-moi des conseils createur et d'autres opportunites",
    createAccount: "Creer un compte",
    guarantee1: "",
    guarantee2: "",
    alreadyAccount: "Vous avez deja un compte ?",
    signIn: "Se connecter",
    newChat: "Reset chat",
    settings: "Parametres",
    disconnect: "Deconnexion",
    legalPrivacy: "Confidentialite",
    legalTerms: "Conditions",
    legalCookies: "Cookies",
    supportLabel: "Support",
    chatSubtitle: "Votre assistant de croissance createur",
    agentEmptyGreetingWithName: "Content de te revoir {name}, on ecrase la journee 💪",
    agentEmptyGreetingGeneric: "Content de te revoir, on ecrase la journee 💪",
    chipViralIdea: "Idee virale du jour",
    chipWeeklyPlan: "Plan de contenu hebdomadaire",
    chipMotivate: "Motive-moi",
    chipPostIdeas: "Idees de posts",
    chipFindVoice: "Trouve ma voix",
    homePromptWeeklyPlan:
      "Cree-moi un plan de contenu pour cette semaine base sur mes dernieres publications.",
    homePromptMotivate:
      "Donne-moi un petit boost de motivation en tant que createur qui se sent bloque aujourd'hui.",
    homePromptPostIdeas:
      "Donne-moi 5 idees de posts adaptees a ma niche et a mes performances recentes.",
    homePromptFindVoice:
      "Aide-moi a trouver ma voix. Quel est mon avantage en tant que createur ?",
    homePromptViralIdea:
      "Donne-moi une idee de contenu virale pour aujourd'hui, adaptee a ma niche et a mon audience.",
    scoreModalSectionWhat: "Qu'est-ce que c'est ?",
    scoreModalSectionDrivers: "Qu'est-ce qui influence ton score ?",
    scoreMetaMomentumName: "Momentum",
    scoreMetaMomentumWhat:
      "Le score Momentum mesure ton elan creatif. Il combine ta regularite et la reaction du public pour voir si tu avances.",
    scoreMetaMomentumDrivers:
      "La combinaison des scores Regularite et Croissance — pour repondre a « Est-ce que je suis sur la bonne voie ? »",
    scoreMetaConsistencyName: "Regularite",
    scoreMetaConsistencyWhat:
      "La regularite reflete ton engagement a publier. C'est le rythme qui aide a creer des habitudes qui se cumulent.",
    scoreMetaConsistencyDrivers:
      "La frequence de tes posts par semaine et la stabilite de ce rythme dans le temps.",
    scoreMetaGrowthName: "Croissance",
    scoreMetaGrowthWhat:
      "La croissance met en avant tes progres en ligne. Elle montre comment ton contenu arrive au public et l'elan que tu construis.",
    scoreMetaGrowthDrivers: "Les tendances d'engagement et de portee, plus les actions que tu prends pour ameliorer.",
    onboardConnectTitle: "Connecte Instagram pour commencer",
    onboardConnectSub:
      "Pour que j'analyse ton contenu et te coach personnellement pour ton audience.",
    onboardConnectInstagram: "Connecter Instagram",
    onboardConnectLogout: "Deconnexion",
    onboardScanPosts: "posts",
    onboardScanLikes: "j'aime",
    onboardScanReach: "portee",
    onboardScanTitle: "Analyse de ton profil...",
    onboardScanStep1: "Analyse des posts",
    onboardScanStep2: "Lecture des legendes",
    onboardScanStep3: "Mesure de la portee",
    onboardScanStep4: "Recherche de ton avantage",
    onboardEdgeTitleSuffix: ", tu as un avantage",
    onboardEdgeSuperKicker: "🔥 Ta superforce",
    onboardEdgeUnlockKicker: "🚀 Ton potentiel",
    onboardEdgeSuperLine1: "Ce que tu",
    onboardEdgeSuperLine2: "maitrises",
    onboardEdgeUnlockLine1: "Ton potentiel",
    onboardEdgeUnlockLine2: "inexploite",
    onboardEdgeCta: "Continuer",
    onboardPaymentTitle: "Active ton offre",
    onboardPaymentSubtitle: "Abonne-toi pour debloquer le coach IA et les analyses completes.",
    onboardPaymentPlanName: "Mensuel",
    onboardPaymentPeriod: "/mois",
    onboardPaymentPerkCancel: "Annule a tout moment",
    onboardPaymentPerkMoney: "Garantie satisfait ou rembourse 30 jours",
    onboardPaymentCta: "Aller au paiement",
    onboardPaymentLoggedInAs: "Connecte en tant que :",
    chatInputPlaceholder: "Message a PostPilot Agent",
    suggestionsLabel: "Suggestions",
    suggestions: [
      { icon: "📊", label: "Analyser les performances", prompt: "Analyse mes dernieres performances et dis-moi quoi ameliorer" },
      { icon: "✏️", label: "Generer un brouillon", prompt: "Ecris un brouillon de publication base sur ma niche et mes contenus les plus performants" },
      { icon: "📅", label: "Plan hebdomadaire", prompt: "Cree mon plan de contenu hebdomadaire avec des idees de publications pour chaque jour" },
      { icon: "♻️", label: "Reutiliser une publication", prompt: "Prends ma publication la plus performante et transforme-la en 3 formats differents" },
      { icon: "💬", label: "Idees de descriptions", prompt: "Donne-moi 5 idees de descriptions engageantes basees sur ma niche et mon audience" },
      { icon: "🚀", label: "Conseils de croissance", prompt: "Quels sont les 3 changements les plus importants que je devrais faire pour grandir plus vite sur les reseaux sociaux ?" },
    ],
    analyticsTotalPosts: "Total publications",
    analyticsTotalLikes: "Total mentions j'aime",
    analyticsTotalComments: "Total commentaires",
    analyticsAvgEngagement: "Interaction moy. / publication",
    analyticsEngagementTrend: "Interactions dans le temps",
    analyticsPerformanceByType: "Performance par type de contenu",
    analyticsBestDay: "Meilleur jour pour publier",
    analyticsCaptionLength: "Longueur de description vs interactions",
    analyticsTopPosts: "Top publications par interactions",
    chartLikes: "J'aime",
    chartComments: "Commentaires",
    chartPosts: "Publications",
    chartAvgEngagement: "Interaction moyenne",
    chartCaptionLengthAxis: "Longueur description (caracteres)",
    chartEngagementAxis: "Interactions",
    chartAvgEngShort: "Int. moy.",
    msgSenderAssistant: "PostPilot",
    msgSenderUser: "Vous",
    send: "Envoyer",
    saveSettings: "Enregistrer les parametres",
    onboardingRequired: "Completez l'onboarding quand vous voulez. J'ai besoin de ces infos avant de vous aider.",
    disconnectToast: "Deconnecte. Reconnectez-vous quand vous voulez.",
    disconnectConfirmTitle: "Confirmer la deconnexion ?",
    disconnectConfirmBody: "Vous serez deconnecte et renvoye vers l'ecran principal.",
    disconnectConfirmCancel: "Annuler",
    disconnectConfirmCta: "Deconnexion",
    newChatStarted: "Nouveau chat demarre. Demandez des brouillons, analyses, reutilisation ou un plan hebdomadaire.",
    onboardingDone: "Onboarding termine. Je suis pret a vous aider sur votre strategie de contenu.",
    settingsSaved: "Parametres enregistres. J'ai actualise votre profil et vos sources de contenu.",
    initialAssistant: "Je suis votre agent IA de contenu. Terminez l'onboarding puis demandez des brouillons, analyses ou plans hebdomadaires.",
    signInModalTitle: "Connexion a PostPilot",
    signInSubmit: "Se connecter",
    signinPasswordPh: "Saisissez votre mot de passe",
    signupPhFullName: "Saisissez votre nom complet",
    signupPhEmail: "vous@exemple.com",
    signupPhPassword: "Creez un mot de passe",
    accountPhName: "Votre nom",
    accountPhEmail: "vous@domaine.com",
    onboardingCreateTitle: "Creer votre compte",
    onboardingCreateSubtitle: "Configurez votre profil createur pour activer l'agent IA.",
    onboardingFormTitle: "Terminer l'onboarding",
    onboardingFormSubtitle:
      "Parlez-nous de votre niche et de votre objectif principal. Vous pourrez connecter LinkedIn et Instagram plus tard dans Parametres.",
    onboardPhNiche: "ex. education createurs pour coachs",
    onboardPhObjective: "ex. augmenter les leads via le contenu",
    shortName: "Nom",
    shortEmail: "E-mail",
    nicheLabel: "Niche",
    objectiveShort: "Objectif",
    onboardObjectiveLabel: "Objectif principal",
    linkedinUsername: "Nom d'utilisateur LinkedIn",
    instagramUsername: "Nom d'utilisateur Instagram",
    completeOnboarding: "Terminer l'onboarding",
    settingsModalHeading: "Parametres",
    tabGeneral: "General",
    tabAccount: "Compte",
    tabConnections: "Connexions",
    tabSupport: "Support",
    panelGeneral: "General",
    panelAccount: "Compte",
    panelConnections: "Connexions",
    panelSupport: "Support",
    settingsLegalTitle: "Mentions legales",
    settingsLegalHint: "Confidentialite, conditions et politique des cookies.",
    supportEmailTitle: "Email support",
    supportEmailHint: "Ecrivez-nous a tout moment pour les problemes de compte ou facturation.",
    supportPhoneTitle: "Telephone support",
    supportPhoneHint: "Pour les demandes urgentes, appelez ce numero.",
    settingsNicheHint: "Votre angle de contenu et votre audience.",
    settingsObjectiveHint: "Le principal objectif de croissance pour ce trimestre.",
    onboardingKicker: "Commencer",
    paymentModeTitle: "Activez votre plan",
    paymentModeSubtitle: "Finalisez votre abonnement de 29 Euro/mois pour debloquer le coach IA.",
    onboardingExplainerTitle: "Ce que fait PostPilot",
    onboardingExplainerBody: "Analyse votre contenu, identifie les tendances de croissance et fournit des actions hebdomadaires pratiques, des brouillons et du feedback.",
    paymentPlanLabel: "PostPilot Pro",
    paymentActivateTitle: "Activez votre abonnement",
    paymentPriceSuffix: " / mois",
    paymentFeature1: "Acces complet au chat de coaching IA",
    paymentFeature2: "Strategie de contenu et generation de brouillons",
    paymentFeature3: "Planification hebdomadaire et insights de performance",
    paymentAgree: "J'accepte de demarrer un abonnement mensuel de 29 Euro.",
    paymentSubmit: "Finaliser le paiement",
    paymentRequiredBeforeContinuing: "Le paiement est requis avant de continuer.",
    paymentCompleteToContinue: "Finalisez le paiement pour continuer.",
    paymentEndpointUnavailable: "Le point de terminaison de paiement est indisponible. Redemarrez le serveur puis reessayez.",
    onboardingMissingFields: "Completez la niche et l'objectif pour continuer.",
    paymentConfirmTerms: "Veuillez confirmer les conditions de l'abonnement.",
    paymentCheckoutSessionError: "Impossible de creer la session Stripe Checkout.",
    checkoutCanceled: "Le checkout a ete annule. Finalisez le paiement pour debloquer le coach IA.",
    checkoutProcessing: "Paiement recu. Verification de l'abonnement en cours...",
    googleConnected: "Connecte avec Google.",
    disconnectIntegrationBtn: "Deconnecter",
    disconnectIntegrationConfirmTitle: "Deconnecter {platform} ?",
    disconnectIntegrationConfirmBody: "Vous serez deconnecte de {platform}. Vous pourrez vous reconnecter plus tard, mais uniquement avec le meme compte @{username}.",
    integrationLockedNote: "Ce profil est lie de maniere permanente a @{username}. Vous ne pouvez vous reconnecter qu'avec le meme compte.",
    integrationAccountMismatch: "Impossible de connecter {platform} : ce profil est lie a @{username}. Veuillez utiliser le meme compte.",
    disconnectedToast: "{platform} a ete deconnecte.",
  },
};

function t(key) {
  return I18N[currentLanguage]?.[key] || I18N.en[key] || key;
}

function tf(key, replacements = {}) {
  let text = t(key);
  for (const [name, value] of Object.entries(replacements)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

function setTextIfExists(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setPlaceholderIfExists(id, value) {
  const el = document.getElementById(id);
  if (el) el.placeholder = value;
}

const ONBOARDING_NICHE_OPTIONS = {
  en: [
    "Business & Entrepreneurship",
    "Marketing & Social Media",
    "Health & Wellness",
    "Fitness & Sports",
    "Education & Coaching",
    "Beauty & Fashion",
    "Travel & Lifestyle",
    "Tech & AI",
    "Personal Development",
    "Other",
  ],
  ro: [
    "Business & Antreprenoriat",
    "Marketing & Social Media",
    "Sanatate & Wellness",
    "Fitness & Sport",
    "Educatie & Coaching",
    "Beauty & Fashion",
    "Calatorii & Lifestyle",
    "Tech & AI",
    "Dezvoltare Personala",
    "Altele",
  ],
};

const ONBOARDING_OBJECTIVE_OPTIONS = {
  en: [
    "Grow audience",
    "Generate leads",
    "Increase sales",
    "Build personal brand",
    "Improve engagement",
    "Post consistently",
    "Launch a product/service",
    "Monetize content",
  ],
  ro: [
    "Crestere audienta",
    "Generare lead-uri",
    "Crestere vanzari",
    "Construire brand personal",
    "Crestere engagement",
    "Postare constanta",
    "Lansare produs/serviciu",
    "Monetizare continut",
  ],
};

function onboardingOptionsForLanguage(optionsMap) {
  return optionsMap[currentLanguage] || optionsMap.en || [];
}

function populateSelectOptions(selectId, placeholder, options) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const previousValue = select.value;
  select.innerHTML = "";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  placeholderOption.disabled = true;
  placeholderOption.selected = !previousValue;
  select.appendChild(placeholderOption);

  for (const label of options) {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    if (previousValue && previousValue === label) {
      option.selected = true;
      placeholderOption.selected = false;
    }
    select.appendChild(option);
  }
}

function setGoogleButtonLabel(button, label) {
  if (!button) return;
  const labelEl = button.querySelector("span");
  if (labelEl) {
    labelEl.textContent = label;
    return;
  }
  button.textContent = label;
}

function syncOnboardingLanguage() {
  // Full-page onboarding uses static markup for its language-neutral steps;
  // re-render the payment step so localized date strings refresh.
  const flow = document.getElementById("onboardFlow");
  if (!flow || flow.classList.contains("hidden")) return;
  if (flow.getAttribute("data-step") === "payment") renderPaymentStep();
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  if (languageSelect) languageSelect.value = currentLanguage;
  if (languageSelectOnboard) languageSelectOnboard.value = currentLanguage;

  setTextIfExists("languageLabel", t("language"));
  setTextIfExists("heroBadge", t("heroBadge"));
  setTextIfExists("heroTitleMain", t("heroTitleMain"));
  setTextIfExists("heroTitleAccent", t("heroTitleAccent"));
  setTextIfExists("heroSubtitle", t("heroSubtitle"));
  setTextIfExists("signal1", t("signal1"));
  setTextIfExists("signal2", t("signal2"));
  setTextIfExists("signal3", t("signal3"));
  setTextIfExists("socialProofTitle", t("socialProofTitle"));
  setTextIfExists("socialProofSubtitle", t("socialProofSubtitle"));
  setTextIfExists("testimonial1Quote", t("testimonial1Quote"));
  setTextIfExists("testimonial1Role", t("testimonial1Role"));
  setTextIfExists("testimonial2Quote", t("testimonial2Quote"));
  setTextIfExists("testimonial2Role", t("testimonial2Role"));
  setTextIfExists("testimonial3Quote", t("testimonial3Quote"));
  setTextIfExists("testimonial3Role", t("testimonial3Role"));
  setTextIfExists("achieveTitle", t("achieveTitle"));
  setTextIfExists("achieveSubtitle", t("achieveSubtitle"));
  setTextIfExists("feature1Title", t("feature1Title"));
  setTextIfExists("feature1Text", t("feature1Text"));
  setTextIfExists("feature2Title", t("feature2Title"));
  setTextIfExists("feature2Text", t("feature2Text"));
  setTextIfExists("feature3Title", t("feature3Title"));
  setTextIfExists("feature3Text", t("feature3Text"));
  setTextIfExists("feature4Title", t("feature4Title"));
  setTextIfExists("feature4Text", t("feature4Text"));
  setTextIfExists("comingSoonBadge", t("comingSoonBadge"));
  setTextIfExists("comingSoonTitle", t("comingSoonTitle"));
  setTextIfExists("comingSoonSubtitle", t("comingSoonSubtitle"));
  setTextIfExists("chip1", t("chip1"));
  setTextIfExists("chip2", t("chip2"));
  setTextIfExists("chip3", t("chip3"));
  setTextIfExists("chip4", t("chip4"));
  setTextIfExists("chip5", t("chip5"));
  setTextIfExists("finalCtaTitle", t("finalCtaTitle"));
  setTextIfExists("finalCtaSubtitle", t("finalCtaSubtitle"));
  setTextIfExists("finalCtaClosing", t("finalCtaClosing"));
  const finalGuaranteeText = t("finalCtaGuarantee");
  setTextIfExists("finalCtaGuarantee", finalGuaranteeText);
  const finalGuaranteeEl = document.getElementById("finalCtaGuarantee");
  if (finalGuaranteeEl) {
    finalGuaranteeEl.classList.toggle("hidden", !String(finalGuaranteeText || "").trim());
  }
  setTextIfExists("finalLegalNote", t("finalLegalNote"));
  if (openTrialBtn) openTrialBtn.textContent = t("signupTitle");
  setTextIfExists("signupTitle", t("signupTitle"));
  setTextIfExists("signupFullNameLabel", t("fullName"));
  setTextIfExists("signupEmailLabel", t("emailAddress"));
  setTextIfExists("signupPasswordLabel", t("password"));
  setTextIfExists("tipsOptInLabel", t("tipsOptIn"));
  setTextIfExists("signupSubmitBtn", t("createAccount"));
  const signupGuarantee1Text = t("guarantee1");
  setTextIfExists("signupGuarantee1", signupGuarantee1Text);
  const signupGuarantee1El = document.getElementById("signupGuarantee1");
  if (signupGuarantee1El) {
    signupGuarantee1El.classList.toggle("hidden", !String(signupGuarantee1Text || "").trim());
  }
  const signupGuarantee2Text = t("guarantee2");
  setTextIfExists("signupGuarantee2", signupGuarantee2Text);
  const signupGuarantee2El = document.getElementById("signupGuarantee2");
  if (signupGuarantee2El) {
    signupGuarantee2El.classList.toggle("hidden", !String(signupGuarantee2Text || "").trim());
  }
  setTextIfExists("alreadyAccountText", t("alreadyAccount"));
  setTextIfExists("openSignin", t("signIn"));
  setTextIfExists("agentViewBtnLabel", t("agentView"));
  setTextIfExists("analyticsViewBtnLabel", t("analyticsView"));
  setTextIfExists("resetChatBtnLabel", t("newChat"));
  setTextIfExists("settingsBtnLabel", t("settings"));
  setTextIfExists("disconnectBtnLabel", t("disconnect"));
  setTextIfExists("legalPrivacyLinkLanding", t("legalPrivacy"));
  setTextIfExists("legalTermsLinkLanding", t("legalTerms"));
  setTextIfExists("legalCookiesLinkLanding", t("legalCookies"));
  setTextIfExists("legalPrivacyLinkApp", t("legalPrivacy"));
  setTextIfExists("legalTermsLinkApp", t("legalTerms"));
  setTextIfExists("legalCookiesLinkApp", t("legalCookies"));
  setTextIfExists("supportTitleLanding", t("supportLabel"));
  setTextIfExists("disconnectConfirmTitle", t("disconnectConfirmTitle"));
  setTextIfExists("disconnectConfirmBody", t("disconnectConfirmBody"));
  setTextIfExists("disconnectCancelBtn", t("disconnectConfirmCancel"));
  setTextIfExists("disconnectConfirmBtn", t("disconnectConfirmCta"));
  setTextIfExists("chatHeaderSubtitle", t("chatSubtitle"));
  setTextIfExists("viralIdeaChipLabel", t("chipViralIdea"));
  setTextIfExists("homeChipWeeklyPlanLabel", t("chipWeeklyPlan"));
  setTextIfExists("homeChipMotivateLabel", t("chipMotivate"));
  setTextIfExists("homeChipPostIdeasLabel", t("chipPostIdeas"));
  setTextIfExists("homeChipFindVoiceLabel", t("chipFindVoice"));
  setTextIfExists("languageLabelOnboard", t("language"));
  setTextIfExists("obConnectTitle", t("onboardConnectTitle"));
  setTextIfExists("obConnectSub", t("onboardConnectSub"));
  setTextIfExists("obConnectInstagramLabel", t("onboardConnectInstagram"));
  setTextIfExists("obConnectLogoutLabel", t("onboardConnectLogout"));
  setTextIfExists("obScanPostsLabel", t("onboardScanPosts"));
  setTextIfExists("obScanLikesLabel", t("onboardScanLikes"));
  setTextIfExists("obScanReachLabel", t("onboardScanReach"));
  setTextIfExists("obScanTitle", t("onboardScanTitle"));
  setTextIfExists("obScanStepLabel", t("onboardScanStep1"));
  setTextIfExists("edgeTitleSuffix", t("onboardEdgeTitleSuffix"));
  setTextIfExists("edgeSuperKicker", t("onboardEdgeSuperKicker"));
  setTextIfExists("edgeUnlockKicker", t("onboardEdgeUnlockKicker"));
  setTextIfExists("edgeSuperTitle1", t("onboardEdgeSuperLine1"));
  setTextIfExists("edgeSuperTitle2", t("onboardEdgeSuperLine2"));
  setTextIfExists("edgeUnlockTitle1", t("onboardEdgeUnlockLine1"));
  setTextIfExists("edgeUnlockTitle2", t("onboardEdgeUnlockLine2"));
  setTextIfExists("edgeStartBtnLabel", t("onboardEdgeCta"));
  setTextIfExists("obPaymentTitle", t("onboardPaymentTitle"));
  setTextIfExists("obPaymentSubtitle", t("onboardPaymentSubtitle"));
  setTextIfExists("obPaymentPlanName", t("onboardPaymentPlanName"));
  setTextIfExists("obPaymentPeriodLabel", t("onboardPaymentPeriod"));
  setTextIfExists("obPaymentPerkCancel", t("onboardPaymentPerkCancel"));
  setTextIfExists("obPaymentPerkMoney", t("onboardPaymentPerkMoney"));
  setTextIfExists("obPaymentStartLabel", t("onboardPaymentCta"));
  setTextIfExists("obPaymentLoggedInLabel", t("onboardPaymentLoggedInAs"));
  setTextIfExists("obPaymentLogoutLabel", t("onboardConnectLogout"));
  setTextIfExists("labelTotalPosts", t("analyticsTotalPosts"));
  setTextIfExists("labelTotalLikes", t("analyticsTotalLikes"));
  setTextIfExists("labelTotalComments", t("analyticsTotalComments"));
  setTextIfExists("labelTotalImpressions", t("analyticsTotalImpressions"));
  setTextIfExists("labelAvgEngagement", t("analyticsAvgEngagement"));
  setTextIfExists("titleEngagementTrend", t("analyticsEngagementTrend"));
  setTextIfExists("titlePerformanceByType", t("analyticsPerformanceByType"));
  setTextIfExists("titleBestDay", t("analyticsBestDay"));
  setTextIfExists("titleCaptionLength", t("analyticsCaptionLength"));
  setTextIfExists("titleTopPosts", t("analyticsTopPosts"));
  setTextIfExists("sendBtn", t("send"));
  setTextIfExists("settingsSaveBtn", t("saveSettings"));

  const messageInput = document.getElementById("messageInput");
  if (messageInput) messageInput.placeholder = t("chatInputPlaceholder");

  buildSuggestionsPopup();

  setGoogleButtonLabel(googleSignupBtn, t("continueGoogle"));
  setGoogleButtonLabel(googleSigninBtn, t("continueGoogle"));
  const dividers = document.querySelectorAll(".divider");
  for (const divider of dividers) divider.textContent = t("or");

  setPlaceholderIfExists("signupFullName", t("signupPhFullName"));
  setPlaceholderIfExists("signupEmail", t("signupPhEmail"));
  setPlaceholderIfExists("signupPassword", t("signupPhPassword"));

  setTextIfExists("signinTitle", t("signInModalTitle"));
  setTextIfExists("signinEmailLabelText", t("emailAddress"));
  setTextIfExists("signinPasswordLabelText", t("password"));
  setTextIfExists("signinSubmitBtn", t("signInSubmit"));
  setPlaceholderIfExists("signinEmail", t("signupPhEmail"));
  setPlaceholderIfExists("signinPassword", t("signinPasswordPh"));

  setTextIfExists("accountFormNameLabel", t("shortName"));
  setTextIfExists("accountFormEmailLabel", t("shortEmail"));
  setTextIfExists("accountFormSubmitBtn", t("createAccount"));
  setPlaceholderIfExists("accountName", t("accountPhName"));
  setPlaceholderIfExists("accountEmail", t("accountPhEmail"));

  setTextIfExists("onboardNicheLabel", t("nicheLabel"));
  setTextIfExists("onboardObjectiveLabel", t("onboardObjectiveLabel"));
  setTextIfExists("onboardingFormSubmitBtn", t("completeOnboarding"));
  setTextIfExists("onboardingKicker", t("onboardingKicker"));
  setTextIfExists("onboardingExplainerTitle", t("onboardingExplainerTitle"));
  setTextIfExists("onboardingExplainerBody", t("onboardingExplainerBody"));
  setTextIfExists("paymentPlanLabel", t("paymentPlanLabel"));
  setTextIfExists("paymentActivateTitle", t("paymentActivateTitle"));
  setTextIfExists("paymentPriceSuffix", t("paymentPriceSuffix"));
  setTextIfExists("paymentFeature1", t("paymentFeature1"));
  setTextIfExists("paymentFeature2", t("paymentFeature2"));
  setTextIfExists("paymentFeature3", t("paymentFeature3"));
  setTextIfExists("paymentAgreeText", t("paymentAgree"));
  setTextIfExists("paymentSubmitBtn", t("paymentSubmit"));
  populateSelectOptions(
    "onboardNiche",
    t("onboardPhNiche"),
    onboardingOptionsForLanguage(ONBOARDING_NICHE_OPTIONS),
  );
  populateSelectOptions(
    "onboardObjective",
    t("onboardPhObjective"),
    onboardingOptionsForLanguage(ONBOARDING_OBJECTIVE_OPTIONS),
  );

  setTextIfExists("settingsModalTitle", t("settingsModalHeading"));
  setTextIfExists("settingsNavGeneral", t("tabGeneral"));
  setTextIfExists("settingsNavAccount", t("tabAccount"));
  setTextIfExists("settingsNavConnections", t("tabConnections"));
  setTextIfExists("settingsNavSupport", t("tabSupport"));
  setTextIfExists("settingsPanelGeneralTitle", t("panelGeneral"));
  setTextIfExists("settingsNicheTitle", t("nicheLabel"));
  setTextIfExists("settingsNicheHint", t("settingsNicheHint"));
  setTextIfExists("settingsObjectiveTitle", t("objectiveShort"));
  setTextIfExists("settingsObjectiveHint", t("settingsObjectiveHint"));
  setTextIfExists("settingsPanelAccountTitle", t("panelAccount"));
  setTextIfExists("settingsNameTitle", t("shortName"));
  setTextIfExists("settingsEmailTitle", t("shortEmail"));
  setTextIfExists("settingsPanelConnectionsTitle", t("panelConnections"));
  setTextIfExists("settingsPanelSupportTitle", t("panelSupport"));
  setTextIfExists("supportEmailLabel", t("supportEmailTitle"));
  setTextIfExists("supportEmailHint", t("supportEmailHint"));
  setTextIfExists("supportPhoneLabel", t("supportPhoneTitle"));
  setTextIfExists("supportPhoneHint", t("supportPhoneHint"));
  setTextIfExists("settingsLegalTitle", t("settingsLegalTitle"));
  setTextIfExists("settingsLegalHint", t("settingsLegalHint"));
  setTextIfExists("settingsLinkedinTitle", t("linkedinUsername"));
  setTextIfExists("settingsInstagramTitle", t("instagramUsername"));
  setTextIfExists("settingsLinkedinStatus", t("notConnected"));
  setTextIfExists("settingsInstagramStatus", t("notConnected"));
  if (connectLinkedinBtn) connectLinkedinBtn.textContent = t("connectAccount");
  if (connectInstagramBtn) connectInstagramBtn.textContent = t("connectAccount");

  if (creatorProfile) {
    renderHomeDashboard(creatorProfile);
  } else {
    setTextIfExists("agentGreeting", t("agentEmptyGreetingGeneric"));
  }

  setTextIfExists("scoreModalWhatTitle", t("scoreModalSectionWhat"));
  setTextIfExists("scoreModalDriversTitle", t("scoreModalSectionDrivers"));
  const scoreModalEl = document.getElementById("scoreModal");
  if (lastOpenScoreKey && creatorProfile && scoreModalEl && !scoreModalEl.classList.contains("hidden")) {
    openScoreModal(lastOpenScoreKey);
  }

  syncOnboardingLanguage();
  if (accountState) applySettingsForm(accountState);
}

if (languageSelect) {
  languageSelect.addEventListener("change", () => {
    currentLanguage = languageSelect.value;
    localStorage.setItem(LANGUAGE_KEY, currentLanguage);
    applyLanguage();
  });
}

if (languageSelectOnboard) {
  languageSelectOnboard.addEventListener("change", () => {
    currentLanguage = languageSelectOnboard.value;
    localStorage.setItem(LANGUAGE_KEY, currentLanguage);
    applyLanguage();
  });
}

async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

function getAuthQueryState() {
  const params = new URLSearchParams(window.location.search);
  return {
    googleAuth: params.get("googleAuth"),
    authError: params.get("authError"),
    authDetail: params.get("authDetail"),
    source: params.get("source") || "signup",
    checkout: params.get("checkout"),
    integration: params.get("integration"),
    integrationAuth: params.get("integrationAuth"),
    integrationError: params.get("integrationError"),
    integrationDetail: params.get("integrationDetail"),
  };
}

function clearAuthQueryParams() {
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());
}

function setText(id, content) {
  const el = document.getElementById(id);
  if (el) el.textContent = content;
}

function setAvatar(id, src, alt) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!src) {
    el.classList.add("hidden");
    el.removeAttribute("src");
    return;
  }
  el.classList.remove("hidden");
  el.src = src;
  if (alt) el.alt = alt;
}

function setHidden(id, hidden) {
  document.getElementById(id).classList.toggle("hidden", hidden);
}

const ONBOARD_STEPS = ["connect", "scan", "edge", "payment"];

function showOnboardStep(step) {
  if (!onboardingModal) return;
  if (onboardingHideTimer) {
    window.clearTimeout(onboardingHideTimer);
    onboardingHideTimer = null;
  }
  onboardingModal.classList.remove("hidden");
  window.requestAnimationFrame(() => {
    onboardingModal.classList.add("is-open");
  });
  onboardingModal.setAttribute("data-step", step);
  const map = {
    connect: "obConnectView",
    scan: "obScanView",
    edge: "obEdgeView",
    payment: "obPaymentView",
  };
  ONBOARD_STEPS.forEach((key) => {
    const el = document.getElementById(map[key]);
    if (el) el.classList.toggle("hidden", key !== step);
  });
  if (chatApp) chatApp.classList.add("is-onboarding");
}

function showOnboardingModal() {
  if (!onboardingModal) return;
  const currentStep = onboardingModal.getAttribute("data-step") || "connect";
  showOnboardStep(currentStep);
}

function hideOnboardingModal() {
  if (!onboardingModal) return;
  onboardingModal.classList.remove("is-open");
  if (onboardingHideTimer) {
    window.clearTimeout(onboardingHideTimer);
  }
  onboardingHideTimer = window.setTimeout(() => {
    onboardingModal.classList.add("hidden");
    onboardingHideTimer = null;
  }, 220);
  if (chatApp) chatApp.classList.remove("is-onboarding");
}

function showToast(message) {
  authToast.textContent = message;
  authToast.classList.remove("hidden");
  window.setTimeout(() => authToast.classList.add("hidden"), 3500);
}

function showFeedback(target, message) {
  target.textContent = message;
}

function clearFeedback() {
  showFeedback(signupFeedback, "");
  showFeedback(signinFeedback, "");
}

function escapeHtml(raw) {
  return String(raw || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || "").trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch (_e) {
    return null;
  }
}

function renderInlineMarkdown(raw) {
  let html = escapeHtml(raw);
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_match, label, url) => {
    const safe = sanitizeUrl(url);
    if (!safe) return label;
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  return html;
}

function renderMarkdown(raw) {
  const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let listType = "";
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const content = paragraph.join("<br>");
    blocks.push(`<p>${content}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listType || !listItems.length) return;
    blocks.push(`<${listType}>${listItems.map((i) => `<li>${i}</li>`).join("")}</${listType}>`);
    listType = "";
    listItems = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(renderInlineMarkdown(unorderedMatch[1]));
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(renderInlineMarkdown(orderedMatch[1]));
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(renderInlineMarkdown(line));
  }

  flushParagraph();
  flushList();

  if (!blocks.length) return "<p></p>";
  return blocks.join("");
}

function createMsgRow(role) {
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;
  const sender = document.createElement("div");
  sender.className = "msg-sender";
  sender.textContent = role === "assistant" ? t("msgSenderAssistant") : t("msgSenderUser");
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  row.appendChild(sender);
  row.appendChild(bubble);
  return { row, bubble };
}

function addMessage(role, content) {
  const messages = document.getElementById("messages");
  const { row, bubble } = createMsgRow(role);
  bubble.innerHTML = renderMarkdown(content);
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
  refreshAgentEmptyState();
}

function renderConversation(conversation = []) {
  const messages = document.getElementById("messages");
  if (!messages) return;
  messages.innerHTML = "";
  for (const item of conversation) {
    if (!item || (item.role !== "assistant" && item.role !== "user")) continue;
    addMessage(item.role, String(item.content || ""));
  }
  refreshAgentEmptyState();
}

async function loadConversationFromServer() {
  const data = await api(`/api/agent/conversation?sessionId=${encodeURIComponent(sessionId)}`);
  renderConversation(Array.isArray(data.conversation) ? data.conversation : []);
}

function addStreamingMessage() {
  const messages = document.getElementById("messages");
  const { row, bubble } = createMsgRow("assistant");
  const cursor = document.createElement("span");
  cursor.className = "streaming-cursor";
  bubble.appendChild(cursor);
  let rawText = "";
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
  return {
    append(token) {
      rawText += String(token || "");
      bubble.insertBefore(document.createTextNode(token), cursor);
      messages.scrollTop = messages.scrollHeight;
    },
    finish() {
      cursor.remove();
      bubble.innerHTML = renderMarkdown(rawText);
    },
    element: bubble,
  };
}

async function streamChat(message, sessionId) {
  const res = await fetch("/api/agent/message/stream", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message, language: currentLanguage }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const handle = addStreamingMessage();
  let buffer = "";
  let fullText = "";
  let lastAction = "ai_reply";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.token) {
            handle.append(data.token);
            fullText += data.token;
          }
          if (data.done) {
            lastAction = data.action || lastAction;
          }
          if (data.error) {
            handle.append(`\nError: ${data.error}`);
          }
        } catch (_e) { /* skip */ }
      }
    }
  } finally {
    handle.finish();
  }

  return { content: fullText, action: lastAction };
}

function setComposerBusy(busy) {
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const suggestionsBtn = document.getElementById("suggestionsBtn");
  const composer = document.getElementById("composer");
  if (input) input.disabled = busy;
  if (sendBtn) sendBtn.disabled = busy;
  if (suggestionsBtn) suggestionsBtn.disabled = busy;
  if (composer) {
    composer.classList.toggle("composer--busy", busy);
    composer.setAttribute("aria-busy", busy ? "true" : "false");
  }
}

function sendPrompt(text) {
  const input = document.getElementById("messageInput");
  input.value = text;
  document.getElementById("composer").requestSubmit();
}

function setActiveView(view) {
  const views = {
    agent: document.getElementById("agentView"),
    analytics: document.getElementById("analyticsView"),
  };
  Object.entries(views).forEach(([name, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", name !== view);
  });
  agentViewBtn?.classList.toggle("active", view === "agent");
  analyticsViewBtn?.classList.toggle("active", view === "analytics");
  refreshAgentEmptyState();
}

function refreshAgentEmptyState() {
  const messagesEl = document.getElementById("messages");
  const emptyEl = document.getElementById("agentEmptyState");
  const scoresEl = document.getElementById("agentScores");
  if (!messagesEl || !emptyEl) return;
  const hasMessages = messagesEl.children.length > 0;
  emptyEl.classList.toggle("hidden", hasMessages);
  messagesEl.classList.toggle("hidden", !hasMessages);
  if (scoresEl) scoresEl.classList.toggle("is-compact", hasMessages);
  if (resetChatBtn) resetChatBtn.classList.toggle("hidden", !hasMessages);
}

const analyticsCharts = {};

const CHART_COLORS = {
  pink: "rgba(194, 49, 96, 0.85)",
  pinkLight: "rgba(194, 49, 96, 0.15)",
  rose: "rgba(232, 121, 149, 0.85)",
  roseLight: "rgba(232, 121, 149, 0.15)",
  plum: "rgba(128, 30, 60, 0.85)",
  plumLight: "rgba(128, 30, 60, 0.15)",
  gold: "rgba(217, 164, 65, 0.85)",
  goldLight: "rgba(217, 164, 65, 0.15)",
  teal: "rgba(56, 161, 148, 0.85)",
  tealLight: "rgba(56, 161, 148, 0.15)",
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { font: { family: "Poppins", size: 11 }, boxWidth: 12, padding: 10 } },
    tooltip: { titleFont: { family: "Poppins" }, bodyFont: { family: "Poppins" } },
  },
  scales: {
    x: { ticks: { font: { family: "Poppins", size: 10 } }, grid: { display: false } },
    y: { ticks: { font: { family: "Poppins", size: 10 } }, grid: { color: "rgba(0,0,0,0.04)" }, beginAtZero: true },
  },
};

function destroyChart(id) {
  if (analyticsCharts[id]) { analyticsCharts[id].destroy(); delete analyticsCharts[id]; }
}

function renderStatCards(summary, posts) {
  const totals = summary.totals || {};
  const totalPosts = Object.values(summary.byPlatform || {}).reduce((a, p) => a + Number(p.posts || 0), 0);
  const totalLikes = Number(totals.likes || 0);
  const totalComments = Number(totals.comments || 0);
  const totalImpressions = Number(totals.impressions || 0);
  const avgEngagement = totalPosts > 0 ? ((totalLikes + totalComments) / totalPosts).toFixed(1) : "0";

  setText("analyticsTotalPosts", Number(totalPosts).toLocaleString());
  setText("analyticsTotalLikes", totalLikes.toLocaleString());
  setText("analyticsTotalComments", totalComments.toLocaleString());
  setText("analyticsTotalImpressions", totalImpressions.toLocaleString());
  setText("analyticsAvgEngagement", avgEngagement);
}

function renderEngagementTrend(posts) {
  const sorted = [...posts].sort((a, b) => new Date(a.postedAt) - new Date(b.postedAt));
  const labels = sorted.map(p => {
    const d = new Date(p.postedAt);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
  const likes = sorted.map(p => Number(p.likes || 0));
  const comments = sorted.map(p => Number(p.comments || 0));
  const impressions = sorted.map(p => Number(p.impressions || 0));

  destroyChart("engagementTrend");
  const ctx = document.getElementById("chartEngagementTrend");
  if (!ctx) return;
  analyticsCharts.engagementTrend = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: t("chartLikes"), data: likes, borderColor: CHART_COLORS.pink, backgroundColor: CHART_COLORS.pinkLight, fill: true, tension: 0.35, pointRadius: 3 },
        { label: t("chartComments"), data: comments, borderColor: CHART_COLORS.teal, backgroundColor: CHART_COLORS.tealLight, fill: true, tension: 0.35, pointRadius: 3 },
        { label: t("chartImpressions"), data: impressions, borderColor: CHART_COLORS.plum, backgroundColor: CHART_COLORS.plumLight, fill: true, tension: 0.35, pointRadius: 3 },
      ],
    },
    options: { ...CHART_DEFAULTS },
  });
}

function renderMediaTypeBreakdown(posts) {
  const buckets = {};
  for (const p of posts) {
    const type = String(p.mediaType || "post").toUpperCase();
    const key = type.includes("REEL") || type === "VIDEO" ? "Reels / Video"
      : type.includes("CAROUSEL") ? "Carousel"
      : type === "IMAGE" ? "Image" : "Other";
    if (!buckets[key]) buckets[key] = { count: 0, likes: 0, comments: 0 };
    buckets[key].count++;
    buckets[key].likes += Number(p.likes || 0);
    buckets[key].comments += Number(p.comments || 0);
  }
  const keys = Object.keys(buckets);
  const avgEng = keys.map(k => {
    const b = buckets[k];
    return b.count > 0 ? +((b.likes + b.comments) / b.count).toFixed(1) : 0;
  });
  const colors = [CHART_COLORS.pink, CHART_COLORS.teal, CHART_COLORS.gold, CHART_COLORS.plum];
  const bgColors = [CHART_COLORS.pinkLight, CHART_COLORS.tealLight, CHART_COLORS.goldLight, CHART_COLORS.plumLight];

  destroyChart("mediaType");
  const ctx = document.getElementById("chartMediaType");
  if (!ctx) return;
  analyticsCharts.mediaType = new Chart(ctx, {
    type: "bar",
    data: {
      labels: keys,
      datasets: [{ label: t("chartAvgEngagement"), data: avgEng, backgroundColor: colors.slice(0, keys.length), borderRadius: 8 }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      scales: { ...CHART_DEFAULTS.scales, x: { ...CHART_DEFAULTS.scales.x, grid: { display: false } } },
    },
  });
}

function renderPostingCadence(posts) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayBuckets = Array.from({ length: 7 }, () => ({ count: 0, engagement: 0 }));
  for (const p of posts) {
    const d = new Date(p.postedAt);
    if (isNaN(d.getTime())) continue;
    const day = d.getDay();
    dayBuckets[day].count++;
    dayBuckets[day].engagement += Number(p.likes || 0) + Number(p.comments || 0);
  }
  const avgByDay = dayBuckets.map(b => b.count > 0 ? +(b.engagement / b.count).toFixed(1) : 0);
  const counts = dayBuckets.map(b => b.count);

  destroyChart("postingCadence");
  const ctx = document.getElementById("chartPostingCadence");
  if (!ctx) return;
  analyticsCharts.postingCadence = new Chart(ctx, {
    type: "bar",
    data: {
      labels: days,
      datasets: [
        { label: t("chartPosts"), data: counts, backgroundColor: CHART_COLORS.roseLight, borderColor: CHART_COLORS.rose, borderWidth: 1, borderRadius: 6, yAxisID: "y" },
        { label: t("chartAvgEngagement"), data: avgByDay, type: "line", borderColor: CHART_COLORS.plum, backgroundColor: "transparent", tension: 0.3, pointRadius: 4, yAxisID: "y1" },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: CHART_DEFAULTS.scales.x,
        y: { ...CHART_DEFAULTS.scales.y, position: "left", title: { display: true, text: t("chartPosts"), font: { family: "Poppins", size: 10 } } },
        y1: { ...CHART_DEFAULTS.scales.y, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: t("chartAvgEngShort"), font: { family: "Poppins", size: 10 } } },
      },
    },
  });
}

function renderCaptionLength(posts) {
  const dataPoints = posts.map(p => ({
    x: String(p.text || "").length,
    y: Number(p.likes || 0) + Number(p.comments || 0),
  }));

  destroyChart("captionLength");
  const ctx = document.getElementById("chartCaptionLength");
  if (!ctx) return;
  analyticsCharts.captionLength = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: t("chartPosts"),
        data: dataPoints,
        backgroundColor: CHART_COLORS.pink,
        borderColor: CHART_COLORS.pinkLight,
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, title: { display: true, text: t("chartCaptionLengthAxis"), font: { family: "Poppins", size: 10 } } },
        y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: t("chartEngagementAxis"), font: { family: "Poppins", size: 10 } } },
      },
    },
  });
}

function renderTopPosts(posts) {
  const sorted = [...posts].sort((a, b) => {
    const engA = Number(a.likes || 0) + Number(a.comments || 0);
    const engB = Number(b.likes || 0) + Number(b.comments || 0);
    return engB - engA;
  }).slice(0, 8);

  const labels = sorted.map((p, i) => {
    const caption = String(p.text || "").trim().slice(0, 30) || `Post ${i + 1}`;
    return caption.length >= 30 ? caption + "…" : caption;
  });
  const likesData = sorted.map(p => Number(p.likes || 0));
  const commentsData = sorted.map(p => Number(p.comments || 0));
  const impressionsData = sorted.map(p => Number(p.impressions || 0));

  destroyChart("topPosts");
  const ctx = document.getElementById("chartTopPosts");
  if (!ctx) return;
  analyticsCharts.topPosts = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: t("chartLikes"), data: likesData, backgroundColor: CHART_COLORS.pink, borderRadius: 6 },
        { label: t("chartComments"), data: commentsData, backgroundColor: CHART_COLORS.teal, borderRadius: 6 },
        { label: t("chartImpressions"), data: impressionsData, backgroundColor: CHART_COLORS.plum, borderRadius: 6 },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: "y",
      plugins: { ...CHART_DEFAULTS.plugins },
      scales: {
        x: { ...CHART_DEFAULTS.scales.y, stacked: true },
        y: { ...CHART_DEFAULTS.scales.x, stacked: true, ticks: { font: { family: "Poppins", size: 10 }, autoSkip: false } },
      },
    },
  });
}

async function loadAnalyticsView() {
  try {
    const [summary, recent] = await Promise.all([
      api("/api/analytics/summary"),
      api("/api/posts/recent?limit=0"),
    ]);
    const posts = recent?.posts || [];
    renderStatCards(summary || {}, posts);
    renderEngagementTrend(posts);
    renderMediaTypeBreakdown(posts);
    renderPostingCadence(posts);
    renderCaptionLength(posts);
    renderTopPosts(posts);
  } catch (err) {
    console.error("Analytics load error:", err);
  }
}

function applyIntegrationUi(platform, integration = {}) {
  const isLinkedin = platform === "linkedin";
  const connected = Boolean(integration.connected);
  const statusId = isLinkedin ? "settingsLinkedinStatus" : "settingsInstagramStatus";
  const connectBtn = isLinkedin ? connectLinkedinBtn : connectInstagramBtn;
  const disconnectBtnEl = isLinkedin ? disconnectLinkedinBtn : disconnectInstagramBtn;
  const lockNoteId = isLinkedin ? "settingsLinkedinLockNote" : "settingsInstagramLockNote";
  const profileId = isLinkedin ? "settingsLinkedinProfile" : "settingsInstagramProfile";
  const handleId = isLinkedin ? "settingsLinkedinHandle" : "settingsInstagramHandle";
  const avatarId = isLinkedin ? "settingsLinkedinAvatar" : "settingsInstagramAvatar";
  const baseName = isLinkedin ? "LinkedIn" : "Instagram";
  const username = String(integration.username || "").trim();
  const avatarUrl = String(integration.avatarUrl || "").trim();
  const lockedUsername = String(integration.lockedUsername || "").trim();
  const lockedId = String(integration.lockedAccountId || "").trim();
  const hasLock = Boolean(lockedUsername || lockedId);

  setText(statusId, connected ? "Connected" : t("notConnected"));
  const statusEl = document.getElementById(statusId);
  if (statusEl) statusEl.classList.toggle("is-connected", connected);

  if (connected && username) {
    setText(profileId, username);
    setText(handleId, `@${username.replace(/^@/, "")}`);
  } else {
    setText(profileId, t("notConnected"));
    setText(handleId, "");
  }

  setAvatar(
    avatarId,
    connected
      ? avatarUrl ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(username || baseName)}&background=f7c6c7&color=7f002d&bold=true&size=96`
      : "",
    `${baseName} profile avatar`,
  );

  if (connectBtn) connectBtn.classList.toggle("hidden", connected);
  if (disconnectBtnEl) {
    disconnectBtnEl.classList.toggle("hidden", !connected);
    disconnectBtnEl.textContent = t("disconnectIntegrationBtn");
  }

  const lockEl = document.getElementById(lockNoteId);
  if (lockEl) {
    if (hasLock && !connected) {
      lockEl.textContent = tf("integrationLockedNote", {
        username: lockedUsername || lockedId,
      });
      lockEl.classList.remove("hidden");
    } else {
      lockEl.textContent = "";
      lockEl.classList.add("hidden");
    }
  }
}

function applySettingsForm(data) {
  const user = data.user || {};
  const integrations = data.integrations || {};
  const billing = data.payment?.details || {};
  document.getElementById("settingsName").value = user.name || "";
  document.getElementById("settingsEmail").value = user.email || "";
  document.getElementById("settingsNiche").value = user.niche || "";
  document.getElementById("settingsObjective").value = user.objective || "";
  applyIntegrationUi("linkedin", integrations.linkedin || {});
  applyIntegrationUi("instagram", integrations.instagram || {});
  const paid = Boolean(data.payment?.completed);
  const status = paid ? "Active" : "Not active";
  const paidAt = billing.paidAt ? ` (since ${new Date(billing.paidAt).toLocaleDateString()})` : "";
  setText("billingStatusText", `Status: ${status}${paidAt}`);
  if (manageBillingBtn) manageBillingBtn.disabled = !billing.stripeCustomerId;
  if (cancelSubscriptionBtn) cancelSubscriptionBtn.disabled = !billing.stripeSubscriptionId;
}

function setOnboardingMode(mode) {
  // Map legacy modes to new full-page steps.
  // "create" and "onboarding" both funnel into the Instagram-connect gate now
  // because the name/email step is handled by signup and niche/objective are gone.
  if (mode === "create" || mode === "onboarding") {
    showOnboardStep("connect");
    return;
  }
  if (mode === "payment") {
    showOnboardStep("payment");
    renderPaymentStep();
    return;
  }
}

function paymentCompleted() {
  return Boolean(accountState?.payment?.completed);
}

function hasAnyIntegrationConnected(data) {
  const integrations = data?.integrations || {};
  return Boolean(integrations.instagram?.connected || integrations.linkedin?.connected);
}

function renderPaymentStep() {
  const email = accountState?.user?.email || "";
  setText("obPaymentLoggedInEmail", email);
}

let suppressOnboardRouting = false;

async function loadAccountState() {
  accountState = await api("/api/account");
  applySettingsForm(accountState);

  if (suppressOnboardRouting) return;

  if (!accountState.user?.createdAt) {
    // Rare edge case: no account yet. Send user back to landing signup.
    hideOnboardingModal();
    chatApp.classList.add("hidden");
    authGate.classList.remove("hidden");
    return;
  }

  if (!hasAnyIntegrationConnected(accountState)) {
    showOnboardStep("connect");
    return;
  }

  if (!paymentCompleted()) {
    showOnboardStep("payment");
    renderPaymentStep();
    return;
  }

  hideOnboardingModal();
}

async function ensureOnboardingForChat() {
  await loadAccountState();
  if (!accountState?.onboarding?.completed) {
    setOnboardingMode(accountState?.user?.createdAt ? "onboarding" : "create");
    showOnboardingModal();
    return false;
  }
  if (!paymentCompleted()) {
    setOnboardingMode("payment");
    showOnboardingModal();
    return false;
  }
  return true;
}

async function unlockChat(toastMessage) {
  authGate.classList.add("hidden");
  chatApp.classList.remove("hidden");
  if (!signinModal.classList.contains("hidden")) signinModal.classList.add("hidden");
  clearFeedback();
  showToast(toastMessage);
  await loadAccountState();
  try {
    await loadConversationFromServer();
  } catch (_error) {
    renderConversation([]);
  }
  try {
    await loadCreatorProfile();
  } catch (_error) {
    // non-blocking
  }
}

async function handleGoogleAuth(source) {
  clearFeedback();
  window.location.assign(`/auth/google?source=${encodeURIComponent(source)}`);
}

function displayPlatform(platform) {
  if (String(platform || "").toLowerCase() === "linkedin") return "LinkedIn";
  if (String(platform || "").toLowerCase() === "instagram") return "Instagram";
  return "Social";
}

async function connectPlatform(platform) {
  // Same flow on desktop and mobile: fetch the OAuth URL over XHR first,
  // then navigate. The async hop puts enough distance between the user tap
  // and the final navigation that iOS Universal Links / Android App Links
  // treat it as a programmatic navigation and usually leave it inside the
  // browser instead of handing it off to the native Instagram app.
  try {
    setText("settingsStatus", tf("integrationRedirecting"));
    const data = await api("/api/integrations/connect", "POST", { platform });
    if (!data.authUrl) {
      throw new Error(t("integrationAuthUrlMissing"));
    }
    window.location.assign(data.authUrl);
  } catch (err) {
    setText("settingsStatus", `${t("integrationConnectFailedPrefix")}: ${err.message}`);
  }
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFeedback();

  const fullName = document.getElementById("signupFullName").value.trim();
  const email = document.getElementById("signupEmail").value.trim().toLowerCase();
  const password = document.getElementById("signupPassword").value;

  if (!fullName || !email || !password) {
    showFeedback(signupFeedback, "Please complete all required fields.");
    return;
  }

  try {
    await api("/api/auth/signup", "POST", { fullName, email, password });
    signupForm.reset();
    await unlockChat(`Welcome to PostPilot, ${fullName}!`);
  } catch (err) {
    showFeedback(signupFeedback, err.message);
  }
});

signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFeedback();

  const email = document.getElementById("signinEmail").value.trim().toLowerCase();
  const password = document.getElementById("signinPassword").value;
  try {
    const data = await api("/api/auth/signin", "POST", { email, password });
    signinForm.reset();
    await unlockChat(`Signed in as ${data.user.email}`);
  } catch (err) {
    showFeedback(signinFeedback, err.message);
  }
});

openSignin.addEventListener("click", (event) => {
  event.preventDefault();
  clearFeedback();
  signinModal.classList.remove("hidden");
});

openTrialBtn.addEventListener("click", () => {
  clearFeedback();
  document.getElementById("signupFullName").focus();
});

closeSignin.addEventListener("click", () => {
  signinModal.classList.add("hidden");
});

closeOnboarding.addEventListener("click", () => {
  if (!paymentCompleted()) {
    setText("onboardingError", t("paymentRequiredBeforeContinuing"));
    setOnboardingMode("payment");
    showOnboardingModal();
    return;
  }
  setText("onboardingError", "");
  hideOnboardingModal();
});

async function performDisconnect() {
  try {
    await api("/api/auth/signout", "POST");
  } catch (_error) {
    // Still clear local UI state even if signout request fails.
  }
  if (disconnectConfirmModal) disconnectConfirmModal.classList.add("hidden");
  setHidden("settingsModal", true);
  signinModal.classList.add("hidden");
  hideOnboardingModal();
  chatApp.classList.add("hidden");
  authGate.classList.remove("hidden");
  clearFeedback();
  showToast(t("disconnectToast"));
}

disconnectBtn.addEventListener("click", () => {
  disconnectConfirmModal?.classList.remove("hidden");
});

disconnectCancelBtn?.addEventListener("click", () => {
  disconnectConfirmModal?.classList.add("hidden");
});

disconnectConfirmBtn?.addEventListener("click", async () => {
  await performDisconnect();
});

signinModal.addEventListener("click", (event) => {
  if (event.target === signinModal) signinModal.classList.add("hidden");
});

onboardingModal?.addEventListener("click", (event) => {
  // Full-page flow: never dismiss on backdrop click.
  void event;
});

disconnectConfirmModal?.addEventListener("click", (event) => {
  if (event.target === disconnectConfirmModal) disconnectConfirmModal.classList.add("hidden");
});

googleSignupBtn.addEventListener("click", () => handleGoogleAuth("signup"));
googleSigninBtn.addEventListener("click", () => handleGoogleAuth("signin"));
connectLinkedinBtn?.addEventListener("click", () => connectPlatform("linkedin"));
connectInstagramBtn?.addEventListener("click", () => connectPlatform("instagram"));

async function disconnectPlatform(platform) {
  const platformLabel = displayPlatform(platform);
  const integration = accountState?.integrations?.[platform] || {};
  const lockedName =
    String(integration.lockedUsername || integration.username || "").replace(/^@/, "") || platformLabel;
  const confirmBody = tf("disconnectIntegrationConfirmBody", {
    platform: platformLabel,
    username: lockedName,
  });
  const confirmTitle = tf("disconnectIntegrationConfirmTitle", { platform: platformLabel });
  if (!window.confirm(`${confirmTitle}\n\n${confirmBody}`)) return;

  try {
    setText("settingsStatus", `${platformLabel}...`);
    const data = await api("/api/integrations/disconnect", "POST", { platform });
    accountState = data;
    applySettingsForm(data);
    setText("settingsStatus", "");
    showToast(tf("disconnectedToast", { platform: platformLabel }));
  } catch (err) {
    setText("settingsStatus", `Error: ${err.message}`);
  }
}

disconnectLinkedinBtn?.addEventListener("click", () => disconnectPlatform("linkedin"));
disconnectInstagramBtn?.addEventListener("click", () => disconnectPlatform("instagram"));

document.getElementById("composer").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSendingMessage) return;
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  if (!message) return;

  isSendingMessage = true;
  setComposerBusy(true);
  input.value = "";
  try {
    const canChat = await ensureOnboardingForChat();
    if (!canChat) {
      input.value = message;
      addMessage("assistant", t("onboardingRequired"));
      return;
    }

    addMessage("user", message);

    const result = await streamChat(message, sessionId);
    if (result.action === "onboarding_required") {
      setOnboardingMode("onboarding");
      showOnboardingModal();
    } else if (result.action === "payment_required") {
      setOnboardingMode("payment");
      showOnboardingModal();
    }
  } catch (err) {
    const msg = String(err.message || "");
    if (/payment required/i.test(msg)) {
      setOnboardingMode("payment");
      showOnboardingModal();
    }
    addMessage("assistant", `Error: ${msg}`);
  } finally {
    isSendingMessage = false;
    setComposerBusy(false);
  }
});

resetChatBtn?.addEventListener("click", async () => {
  try {
    await api("/api/agent/conversation/reset", "POST", { sessionId });
    const messages = document.getElementById("messages");
    messages.innerHTML = "";
    refreshAgentEmptyState();
  } catch (err) {
    showToast(`Could not reset chat: ${err.message}`);
  }
});

agentViewBtn?.addEventListener("click", () => {
  setActiveView("agent");
});

analyticsViewBtn?.addEventListener("click", async () => {
  setActiveView("analytics");
  await loadAnalyticsView();
});

document.getElementById("obConnectInstagramBtn")?.addEventListener("click", () => {
  connectPlatform("instagram");
});
document.getElementById("obConnectLogoutBtn")?.addEventListener("click", () => {
  performDisconnect();
});
document.getElementById("obPaymentLogoutBtn")?.addEventListener("click", () => {
  performDisconnect();
});
document.getElementById("obPaymentStartBtn")?.addEventListener("click", () => {
  document.getElementById("paymentForm")?.requestSubmit();
});

document.getElementById("settingsBtn").addEventListener("click", async () => {
  setHidden("settingsModal", false);
  try {
    await loadAccountState();
  } catch (err) {
    setText("settingsStatus", `Could not load settings: ${err.message}`);
  }
});

document.getElementById("closeSettingsBtn").addEventListener("click", () => {
  setHidden("settingsModal", true);
});

document.getElementById("accountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.getElementById("accountName").value.trim();
  const email = document.getElementById("accountEmail").value.trim();

  try {
    await api("/api/account/create", "POST", { name, email });
    setText("onboardingError", "");
    setOnboardingMode("onboarding");
  } catch (err) {
    const msg = String(err.message || "");
    if (/route not found/i.test(msg)) {
      setText("onboardingError", t("paymentEndpointUnavailable"));
      return;
    }
    setText("onboardingError", msg);
  }
});

document.getElementById("onboardingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const niche = document.getElementById("onboardNiche").value.trim();
  const objective = document.getElementById("onboardObjective").value.trim();

  if (!niche || !objective) {
    setText("onboardingError", t("onboardingMissingFields"));
    return;
  }

  try {
    await api("/api/account/onboarding/complete", "POST", {
      niche,
      objective,
    });
    setText("onboardingError", "");
    setOnboardingMode("payment");
    showOnboardingModal();
    await loadAccountState();
    addMessage("assistant", t("onboardingDone"));
  } catch (err) {
    setText("onboardingError", err.message);
  }
});

document.getElementById("paymentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const confirmed = document.getElementById("paymentConfirm").checked;
  if (!confirmed) {
    setText("onboardingError", t("paymentConfirmTerms"));
    setText("obPaymentError", t("paymentConfirmTerms"));
    return;
  }
  setText("obPaymentError", "");
  const startBtn = document.getElementById("obPaymentStartBtn");
  if (startBtn) startBtn.disabled = true;
  try {
    const data = await api("/api/payment/create-checkout-session", "POST", { plan: "monthly" });
    if (!data.checkoutUrl) {
      throw new Error(t("paymentCheckoutSessionError"));
    }
    window.location.assign(data.checkoutUrl);
  } catch (err) {
    setText("onboardingError", err.message);
    setText("obPaymentError", err.message);
    if (startBtn) startBtn.disabled = false;
  }
});

document.getElementById("settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById("settingsName").value.trim(),
    email: document.getElementById("settingsEmail").value.trim(),
    niche: document.getElementById("settingsNiche").value.trim(),
    objective: document.getElementById("settingsObjective").value.trim(),
    linkedinUsername: accountState?.integrations?.linkedin?.username || "",
    instagramUsername: accountState?.integrations?.instagram?.username || "",
  };
  try {
    const data = await api("/api/settings/save", "POST", payload);
    accountState = data;
    applySettingsForm(data);
    addMessage("assistant", t("settingsSaved"));
  } catch (err) {
    setText("settingsStatus", `Error: ${err.message}`);
  }
});

manageBillingBtn?.addEventListener("click", async () => {
  try {
    setText("settingsStatus", "Opening billing portal...");
    const data = await api("/api/payment/create-portal-session", "POST");
    window.location.assign(data.url);
  } catch (err) {
    setText("settingsStatus", `Error: ${err.message}`);
  }
});

cancelSubscriptionBtn?.addEventListener("click", async () => {
  const ok = window.confirm("Cancel your subscription at period end?");
  if (!ok) return;
  try {
    setText("settingsStatus", "Updating subscription...");
    await api("/api/payment/cancel-subscription", "POST");
    setText("settingsStatus", "Subscription set to cancel at period end.");
    await loadAccountState();
  } catch (err) {
    setText("settingsStatus", `Error: ${err.message}`);
  }
});

for (const tabButton of document.querySelectorAll(".settings-nav-btn")) {
  tabButton.addEventListener("click", () => {
    const tab = tabButton.getAttribute("data-tab");
    for (const btn of document.querySelectorAll(".settings-nav-btn")) {
      btn.classList.toggle("active", btn === tabButton);
    }
    for (const panel of document.querySelectorAll(".settings-panel")) {
      panel.classList.toggle("active", panel.getAttribute("data-panel") === tab);
    }
  });
}

function buildSuggestionsPopup() {
  const popup = document.getElementById("suggestionsPopup");
  if (!popup) return;
  popup.innerHTML = "";
  const suggestions = t("suggestions");
  if (!Array.isArray(suggestions)) return;
  for (const s of suggestions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggestion-item";
    if (s.icon) {
      const ico = document.createElement("span");
      ico.className = "suggestion-item-icon";
      ico.textContent = s.icon;
      btn.appendChild(ico);
    }
    const label = document.createElement("span");
    label.className = "suggestion-item-label";
    label.textContent = s.label;
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      const input = document.getElementById("messageInput");
      if (input) { input.value = s.prompt; input.focus(); }
      popup.classList.add("hidden");
    });
    popup.appendChild(btn);
  }
}

const suggestionsBtn = document.getElementById("suggestionsBtn");
const suggestionsPopup = document.getElementById("suggestionsPopup");

if (suggestionsBtn && suggestionsPopup) {
  suggestionsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    suggestionsPopup.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!suggestionsPopup.contains(e.target) && e.target !== suggestionsBtn) {
      suggestionsPopup.classList.add("hidden");
    }
  });
}

/* ============================================================
   Creator profile: scores, superpower, unlock
   ============================================================ */

let creatorProfile = null;
let lastOpenScoreKey = null;

function getScoreMeta(scoreKey) {
  const icons = { momentum: "⚡", consistency: "🗓", growth: "📈" };
  if (!icons[scoreKey]) return null;
  const cap = scoreKey.charAt(0).toUpperCase() + scoreKey.slice(1);
  return {
    icon: icons[scoreKey],
    name: t(`scoreMeta${cap}Name`),
    what: t(`scoreMeta${cap}What`),
    drivers: t(`scoreMeta${cap}Drivers`),
  };
}

async function loadCreatorProfile() {
  try {
    const data = await api("/api/creator/profile");
    creatorProfile = data;
    renderHomeDashboard(data);
    return data;
  } catch (err) {
    console.warn("Creator profile load failed:", err.message);
    return null;
  }
}

function renderHomeDashboard(profile) {
  const greetingEl = document.getElementById("agentGreeting");
  if (!profile) {
    if (greetingEl) greetingEl.textContent = t("agentEmptyGreetingGeneric");
    return;
  }
  const scores = profile.scores || { momentum: 0, consistency: 0, growth: 0 };
  ["momentum", "consistency", "growth"].forEach((key) => {
    const value = Math.max(0, Math.min(100, Number(scores[key] || 0)));
    const valueEl = document.querySelector(`[data-score-value="${key}"]`);
    if (valueEl) valueEl.textContent = String(value);
    const chip = document.querySelector(`.score-chip[data-score="${key}"] .score-ring`);
    if (chip) chip.style.setProperty("--pct", String(value));
  });

  const firstName = profile.user?.firstName || profile.user?.name?.split(" ")[0] || "";
  if (greetingEl) {
    greetingEl.textContent = firstName
      ? tf("agentEmptyGreetingWithName", { name: firstName })
      : t("agentEmptyGreetingGeneric");
  }
}

function openScoreModal(scoreKey) {
  const meta = getScoreMeta(scoreKey);
  if (!meta || !creatorProfile) return;
  lastOpenScoreKey = scoreKey;
  const value = Math.max(0, Math.min(100, Number(creatorProfile.scores?.[scoreKey] || 0)));
  const modal = document.getElementById("scoreModal");
  if (!modal) return;
  setTextIfExists("scoreModalWhatTitle", t("scoreModalSectionWhat"));
  setTextIfExists("scoreModalDriversTitle", t("scoreModalSectionDrivers"));
  document.getElementById("scoreModalIcon").textContent = meta.icon;
  document.getElementById("scoreModalName").textContent = meta.name;
  const fill = document.getElementById("scoreModalBarFill");
  fill.style.width = `${value}%`;
  document.getElementById("scoreModalValue").textContent = String(value);
  document.getElementById("scoreModalWhatBody").textContent = meta.what;
  document.getElementById("scoreModalDriversBody").textContent = meta.drivers;
  modal.classList.remove("hidden");
}

function closeScoreModal() {
  lastOpenScoreKey = null;
  document.getElementById("scoreModal")?.classList.add("hidden");
}

document.querySelectorAll(".score-chip[data-score]").forEach((btn) => {
  btn.addEventListener("click", () => openScoreModal(btn.getAttribute("data-score")));
});

document.getElementById("closeScoreModal")?.addEventListener("click", closeScoreModal);
document.getElementById("scoreModal")?.addEventListener("click", (event) => {
  if (event.target.id === "scoreModal") closeScoreModal();
});

/* ============================================================
   Home quick actions -> switch to chat view with prompt
   ============================================================ */

function getHomePrompts() {
  return {
    "weekly-plan": t("homePromptWeeklyPlan"),
    motivate: t("homePromptMotivate"),
    "post-ideas": t("homePromptPostIdeas"),
    "find-voice": t("homePromptFindVoice"),
    "viral-idea": t("homePromptViralIdea"),
  };
}

function sendHomePrompt(promptKey, fallbackText) {
  const text = getHomePrompts()[promptKey] || fallbackText || "";
  if (!text) return;
  setActiveView("agent");
  const input = document.getElementById("messageInput");
  if (input) input.value = text;
  document.getElementById("composer")?.requestSubmit();
}

document.querySelectorAll(".suggest-chip[data-prompt]").forEach((btn) => {
  btn.addEventListener("click", () => sendHomePrompt(btn.getAttribute("data-prompt")));
});

document.getElementById("viralIdeaChip")?.addEventListener("click", () => sendHomePrompt("viral-idea"));

/* ============================================================
   Scan + Edge results flow (post-connect onboarding)
   ============================================================ */

function formatCompactNumber(num) {
  const n = Number(num) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

async function renderScanView(profile) {
  const avatar = String(profile?.primary?.avatarUrl || "").trim();
  const handle = String(profile?.primary?.handle || "").trim();
  const avatarEl = document.getElementById("obScanAvatar");
  const fallbackAvatar = handle
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(handle)}&background=f7c6c7&color=7f002d&bold=true&size=176`
    : "/logo.png";
  if (avatarEl) avatarEl.src = avatar || fallbackAvatar;
  setText("obScanHandle", handle ? `@${handle}` : "");

  const metrics = profile?.metrics || {};
  setText("obScanPosts", formatCompactNumber(profile?.postsCount || 0));
  setText("obScanLikes", formatCompactNumber(metrics.totalLikes || 0));
  setText("obScanReach", formatCompactNumber(metrics.totalViews || metrics.totalReach || 0));

  const previewEl = document.getElementById("obScanPostsPreview");
  if (previewEl) {
    previewEl.innerHTML = "";
    try {
      const data = await api("/api/posts/recent?limit=6");
      const posts = Array.isArray(data?.posts) ? data.posts : [];
      const withImages = posts.filter((p) => p.imageUrl || p.thumbnailUrl || p.mediaUrl).slice(0, 4);
      if (!withImages.length) {
        for (let i = 0; i < 4; i += 1) {
          const skel = document.createElement("div");
          skel.className = "scan-preview-tile scan-preview-skeleton";
          previewEl.appendChild(skel);
        }
      } else {
        withImages.forEach((post, idx) => {
          const tile = document.createElement("div");
          tile.className = "scan-preview-tile";
          tile.style.animationDelay = `${idx * 120}ms`;
          const src = post.imageUrl || post.thumbnailUrl || post.mediaUrl;
          if (src) {
            const img = document.createElement("img");
            img.src = src;
            img.alt = "";
            img.loading = "lazy";
            img.referrerPolicy = "no-referrer";
            tile.appendChild(img);
          }
          const meta = document.createElement("span");
          meta.className = "scan-preview-meta";
          const likes = Number(post.likes || 0);
          meta.textContent = `❤ ${formatCompactNumber(likes)}`;
          tile.appendChild(meta);
          previewEl.appendChild(tile);
        });
      }
    } catch (_err) {
      // Non-blocking - preview tiles are optional enhancement.
    }
  }

  setText("obScanPostsLabel", t("onboardScanPosts"));
  setText("obScanLikesLabel", t("onboardScanLikes"));
  setText("obScanReachLabel", t("onboardScanReach"));
  setText("obScanTitle", t("onboardScanTitle"));
  setText("obScanStepLabel", t("onboardScanStep1"));
}

function renderEdgeView(profile) {
  if (!profile) return;
  const avatarEl = document.getElementById("edgeAvatar");
  const handle = String(profile.primary?.handle || "").trim();
  const fallbackAvatar = handle
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(handle)}&background=f7c6c7&color=7f002d&bold=true&size=240`
    : "/logo.png";
  if (avatarEl) avatarEl.src = profile.primary?.avatarUrl || fallbackAvatar;
  setText("edgeFirstName", profile.user?.firstName || handle || "friend");

  const superList = document.getElementById("edgeSuperList");
  const unlockList = document.getElementById("edgeUnlockList");
  if (superList) {
    superList.innerHTML = (profile.superpower || [])
      .map(
        (item) =>
          `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.body)}</li>`,
      )
      .join("");
  }
  if (unlockList) {
    unlockList.innerHTML = (profile.unlock || [])
      .map(
        (item) =>
          `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.body)}</li>`,
      )
      .join("");
  }
}

async function startScanFlow() {
  const profile = await loadCreatorProfile();
  if (!profile?.hasAnyConnection) {
    showOnboardStep("connect");
    return;
  }
  showOnboardStep("scan");
  await renderScanView(profile);
  const progressBar = document.getElementById("obScanProgressBar");
  if (progressBar) {
    progressBar.style.transition = "none";
    progressBar.style.width = "0%";
    window.requestAnimationFrame(() => {
      progressBar.style.transition = "width 3000ms ease-out";
      progressBar.style.width = "100%";
    });
  }
  const stepLabelEl = document.getElementById("obScanStepLabel");
  const steps = [
    t("onboardScanStep1"),
    t("onboardScanStep2"),
    t("onboardScanStep3"),
    t("onboardScanStep4"),
  ];
  let stepIdx = 0;
  const stepTimer = window.setInterval(() => {
    stepIdx = Math.min(steps.length - 1, stepIdx + 1);
    if (stepLabelEl) stepLabelEl.textContent = steps[stepIdx];
  }, 750);

  await new Promise((r) => window.setTimeout(r, 3100));
  window.clearInterval(stepTimer);
  renderEdgeView(profile);
  showOnboardStep("edge");
}

document.getElementById("edgeStartBtn")?.addEventListener("click", () => {
  if (!paymentCompleted()) {
    showOnboardStep("payment");
    renderPaymentStep();
  } else {
    hideOnboardingModal();
    setActiveView("agent");
  }
});

renderConversation([]);
applyLanguage();
setActiveView("agent");

const authQueryState = getAuthQueryState();
let handledFreshGoogleAuth = false;
if (authQueryState.authError) {
  const target = authQueryState.source === "signin" ? signinFeedback : signupFeedback;
  showFeedback(
    target,
    authQueryState.authDetail
      ? `Google sign-in failed (${authQueryState.authError}: ${authQueryState.authDetail}).`
      : `Google sign-in failed (${authQueryState.authError}).`,
  );
  clearAuthQueryParams();
}

if (authQueryState.checkout === "cancel") {
  showFeedback(signupFeedback, t("checkoutCanceled"));
  clearAuthQueryParams();
}

if (authQueryState.checkout === "success") {
  showToast(t("checkoutProcessing"));
  clearAuthQueryParams();
}

if (authQueryState.integrationAuth === "success" && authQueryState.integration) {
  const platformLabel = displayPlatform(authQueryState.integration);
  showToast(tf("integrationConnectedToast", { platform: platformLabel }));
  clearAuthQueryParams();
  // Suppress automatic routing so the scan/edge flow owns the screen.
  suppressOnboardRouting = true;
  showOnboardStep("scan");
  window.setTimeout(() => {
    startScanFlow()
      .catch(() => {})
      .finally(() => {
        suppressOnboardRouting = false;
      });
  }, 400);
}

if (authQueryState.integrationError && authQueryState.integration) {
  const platformLabel = displayPlatform(authQueryState.integration);
  let toastText;
  if (authQueryState.integrationError === "account_mismatch") {
    const lockedName = String(authQueryState.integrationDetail || "").replace(/^@/, "") || platformLabel;
    toastText = tf("integrationAccountMismatch", { platform: platformLabel, username: lockedName });
  } else {
    const errorDetail = authQueryState.integrationDetail
      ? `${authQueryState.integrationError}: ${authQueryState.integrationDetail}`
      : authQueryState.integrationError;
    toastText = tf("integrationConnectErrorToast", { platform: platformLabel, error: errorDetail });
  }
  showToast(toastText);
  clearAuthQueryParams();
}

if (authQueryState.googleAuth === "success") {
  handledFreshGoogleAuth = true;
  unlockChat(t("googleConnected")).catch((err) => {
    const target = authQueryState.source === "signin" ? signinFeedback : signupFeedback;
    showFeedback(target, `Could not finish Google sign-in: ${err.message}`);
  });
  clearAuthQueryParams();
}

if (!handledFreshGoogleAuth) {
  api("/api/auth/session")
    .then((session) => {
      if (session.authenticated) {
        unlockChat(`Welcome back, ${session.user.fullName}.`).catch((err) => {
          showFeedback(signupFeedback, `Could not restore session: ${err.message}`);
        });
      }
    })
    .catch(() => {});
}
