/**
 * Plain-language wording for the technician screens (DEC-026, DEC-027).
 *
 * Rules: short words, one idea per label, the same word for the same thing everywhere.
 * Hindi is a DRAFT until a native speaker who knows the technicians' everyday speech
 * has reviewed it. Every key must exist in both languages (checked by tests/i18n.test.js).
 * `{name}` style placeholders are filled in by t().
 */
export const DICTIONARY = {
  en: {
    'app.name': 'BBDU Hosteller',
    'lang.en': 'English',
    'lang.hi': 'हिन्दी',
    'menu.account': 'Account',
    'menu.changePassword': 'Change password',
    'menu.signOut': 'Sign out',

    'common.loading': 'Loading...',
    'common.refresh': 'Refresh',
    'common.retry': 'Try again',
    'common.cancel': 'Cancel',
    'common.back': 'Back',

    'jobs.title': 'My jobs',
    'jobs.hello': 'Hello, {name}',
    'jobs.summary.none': 'No jobs waiting for you',
    'jobs.summary.one': 'You have 1 job to do',
    'jobs.summary.many': 'You have {n} jobs to do',
    'jobs.empty.title': 'No jobs right now',
    'jobs.empty.body': 'When the warden gives you a job, it will show here.',
    'jobs.updated': 'Updated {time}',
    'jobs.showSection': 'Show',
    'jobs.hideSection': 'Hide',

    'section.redo': 'Student says not fixed',
    'section.new': 'New jobs',
    'section.ready': 'Ready to start',
    'section.working': 'Being fixed',
    'section.waiting': 'Waiting for student to confirm',
    'section.done': 'Done',

    'stage.redo': 'Student says not fixed',
    'stage.new': 'New job',
    'stage.ready': 'Ready to start',
    'stage.working': 'Being fixed',
    'stage.waiting': 'Waiting for student',
    'stage.done': 'Done',

    'action.acknowledge': 'I got it',
    'action.start': 'Start work',
    'action.finish': 'Work finished',
    'action.resume': 'Start again',
    'action.wait': 'Please wait...',

    'due.late': 'Late by {time}',
    'due.soon': 'Hurry, due in {time}',
    'due.ok': 'Due in {time}',
    'time.minutes': '{n} min',
    'time.hours': '{n} hr',
    'time.days': '{n} days',
    'time.now': 'just now',

    'priority.CRITICAL': 'Very urgent',
    'priority.HIGH': 'Urgent',
    'priority.MEDIUM': 'Normal',
    'priority.LOW': 'Can wait',

    'category.PLUMBING': 'Water and pipes',
    'category.ELECTRICAL': 'Electricity',
    'category.WATER': 'Water supply',
    'category.ROOM': 'Room problem',
    'category.FURNITURE': 'Furniture',
    'category.MESS': 'Food and mess',
    'category.CLEANING': 'Cleaning',
    'category.SECURITY': 'Safety',
    'category.INTERNET': 'Internet',
    'category.OTHER': 'Other',

    'job.room': 'Room {room}',
    'job.roomUnknown': 'Room not given',
    'job.back': 'My jobs',
    'job.whatIsWrong': 'What is wrong',
    'job.reporter': 'Reported by',
    'job.studentSaid': 'The student says it is not fixed:',
    'job.moreDetails': 'More details',
    'job.where': 'Where',
    'job.hostel': 'Hostel',
    'job.block': 'Block',
    'job.floor': 'Floor',
    'job.reportedOn': 'Reported on',
    'job.givenOn': 'Given to you on',
    'job.steps.got': 'Got it',
    'job.steps.started': 'Started',
    'job.steps.finished': 'Finished',
    'job.steps.confirmed': 'Student confirms',
    'job.waitingNote': 'You are finished. We are waiting for the student to confirm.',
    'job.doneNote': 'This job is complete.',

    'finish.title': 'What did you do?',
    'finish.hint': 'Tap what fits, or write it below.',
    'finish.placeholder': 'Write here if needed',
    'finish.tooShort': 'Tap a choice or write a few words.',
    'finish.p1': 'Pipe fixed',
    'finish.p2': 'Part replaced',
    'finish.p3': 'Cleaned and checked',
    'finish.p4': 'Leak stopped',
    'finish.p5': 'Wiring repaired',
    'finish.p6': 'Door or lock fixed',

    'toast.acknowledged': 'Got it. Start when you are ready.',
    'toast.started': 'Work started. The student is told.',
    'toast.finished': 'Well done. The student will now confirm.',
    'toast.resumed': 'Started again.',

    'error.load': 'Could not load. Check your internet and try again.',
    'error.action': 'That did not work. Please try again.',
    'error.notFound': 'This job was not found. It may have been given to someone else.',
  },

  hi: {
    'app.name': 'बीबीडीयू हॉस्टलर',
    'lang.en': 'English',
    'lang.hi': 'हिन्दी',
    'menu.account': 'खाता',
    'menu.changePassword': 'पासवर्ड बदलें',
    'menu.signOut': 'बाहर निकलें',

    'common.loading': 'खुल रहा है...',
    'common.refresh': 'फिर से देखें',
    'common.retry': 'फिर कोशिश करें',
    'common.cancel': 'रद्द करें',
    'common.back': 'पीछे',

    'jobs.title': 'मेरे काम',
    'jobs.hello': 'नमस्ते, {name}',
    'jobs.summary.none': 'अभी आपके लिए कोई काम नहीं है',
    'jobs.summary.one': 'आपके पास 1 काम है',
    'jobs.summary.many': 'आपके पास {n} काम हैं',
    'jobs.empty.title': 'अभी कोई काम नहीं है',
    'jobs.empty.body': 'वार्डन जब आपको कोई काम देंगे, वह यहाँ दिखेगा।',
    'jobs.updated': '{time} पर देखा',
    'jobs.showSection': 'दिखाएँ',
    'jobs.hideSection': 'छिपाएँ',

    'section.redo': 'विद्यार्थी कहता है ठीक नहीं हुआ',
    'section.new': 'नए काम',
    'section.ready': 'शुरू करना है',
    'section.working': 'ठीक हो रहा है',
    'section.waiting': 'विद्यार्थी की पुष्टि का इंतज़ार',
    'section.done': 'पूरे हुए',

    'stage.redo': 'ठीक नहीं हुआ',
    'stage.new': 'नया काम',
    'stage.ready': 'शुरू करना है',
    'stage.working': 'ठीक हो रहा है',
    'stage.waiting': 'विद्यार्थी का इंतज़ार',
    'stage.done': 'पूरा हुआ',

    'action.acknowledge': 'मिल गया',
    'action.start': 'काम शुरू करें',
    'action.finish': 'काम पूरा हुआ',
    'action.resume': 'दोबारा शुरू करें',
    'action.wait': 'रुकिए...',

    'due.late': '{time} की देर हो गई',
    'due.soon': 'जल्दी करें, {time} बचे हैं',
    'due.ok': '{time} में पूरा करना है',
    'time.minutes': '{n} मिनट',
    'time.hours': '{n} घंटे',
    'time.days': '{n} दिन',
    'time.now': 'अभी',

    'priority.CRITICAL': 'बहुत जरूरी',
    'priority.HIGH': 'जरूरी',
    'priority.MEDIUM': 'सामान्य',
    'priority.LOW': 'रुक सकता है',

    'category.PLUMBING': 'पानी और पाइप',
    'category.ELECTRICAL': 'बिजली',
    'category.WATER': 'पानी की सप्लाई',
    'category.ROOM': 'कमरे की समस्या',
    'category.FURNITURE': 'फर्नीचर',
    'category.MESS': 'खाना और मेस',
    'category.CLEANING': 'सफ़ाई',
    'category.SECURITY': 'सुरक्षा',
    'category.INTERNET': 'इंटरनेट',
    'category.OTHER': 'दूसरा',

    'job.room': 'कमरा {room}',
    'job.roomUnknown': 'कमरा नहीं बताया',
    'job.back': 'मेरे काम',
    'job.whatIsWrong': 'क्या खराबी है',
    'job.reporter': 'किसने बताया',
    'job.studentSaid': 'विद्यार्थी कहता है ठीक नहीं हुआ:',
    'job.moreDetails': 'और जानकारी',
    'job.where': 'कहाँ',
    'job.hostel': 'हॉस्टल',
    'job.block': 'ब्लॉक',
    'job.floor': 'मंज़िल',
    'job.reportedOn': 'बताया गया',
    'job.givenOn': 'आपको मिला',
    'job.steps.got': 'मिल गया',
    'job.steps.started': 'शुरू',
    'job.steps.finished': 'पूरा',
    'job.steps.confirmed': 'विद्यार्थी की पुष्टि',
    'job.waitingNote': 'आपका काम पूरा हो गया। विद्यार्थी की पुष्टि का इंतज़ार है।',
    'job.doneNote': 'यह काम पूरा हो चुका है।',

    'finish.title': 'आपने क्या किया?',
    'finish.hint': 'जो सही हो उसे दबाएँ, या नीचे लिखें।',
    'finish.placeholder': 'ज़रूरत हो तो यहाँ लिखें',
    'finish.tooShort': 'कोई विकल्प दबाएँ या कुछ शब्द लिखें।',
    'finish.p1': 'पाइप ठीक किया',
    'finish.p2': 'पुर्जा बदला',
    'finish.p3': 'साफ़ करके जाँचा',
    'finish.p4': 'रिसाव बंद किया',
    'finish.p5': 'वायरिंग ठीक की',
    'finish.p6': 'दरवाज़ा या ताला ठीक किया',

    'toast.acknowledged': 'मिल गया। तैयार हों तब शुरू करें।',
    'toast.started': 'काम शुरू हुआ। विद्यार्थी को बता दिया गया।',
    'toast.finished': 'शाबाश। अब विद्यार्थी पुष्टि करेगा।',
    'toast.resumed': 'दोबारा शुरू हुआ।',

    'error.load': 'खुल नहीं सका। इंटरनेट देखें और फिर कोशिश करें।',
    'error.action': 'यह नहीं हो पाया। फिर कोशिश करें।',
    'error.notFound': 'यह काम नहीं मिला। हो सकता है किसी और को दे दिया गया हो।',
  },
};

export const SUPPORTED_LANGUAGES = Object.keys(DICTIONARY);
export const FALLBACK_LANGUAGE = 'en';

/**
 * Looks a key up and fills `{placeholders}`. Falls back to English, then to the key
 * itself, so a missing translation shows something readable instead of crashing.
 *
 * @param {string} language 'en' | 'hi'
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 */
export const translate = (language, key, params = {}) => {
  const table = DICTIONARY[language] || DICTIONARY[FALLBACK_LANGUAGE];
  const template = table[key] ?? DICTIONARY[FALLBACK_LANGUAGE][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined || params[name] === null ? match : String(params[name])
  );
};
