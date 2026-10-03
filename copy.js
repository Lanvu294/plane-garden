/* ============================================================================
   Every word the question panel says, in one place, so it can be edited with
   IEX. `{n}`-style placeholders are filled in by the panel.

   VERIFY WITH IEX before launch: office hours (contact.hours), the
   confidential-resource line (contact.urgent), and whether questions really
   are reviewed before posting (ask.reassure[2]). The mock data does review
   them; the live /api/questions endpoint does not yet.
   ========================================================================== */
window.QF_COPY = {
  dock: { ask: 'Ask a question', askShort: 'Ask', all: 'All questions' },

  tabs: {
    label: 'Questions',
    answered: 'Answered',
    waiting: 'Waiting',
    ask: 'Ask',
    back: '← Back',
    close: 'Close questions'
  },

  answered: {
    kicker: 'From IEX',
    title: 'Questions, answered',
    search: 'Search questions',
    searchHint: 'Press / to search',
    count: '{n} of {total}',
    clear: 'Clear search',
    cue: 'Showing answered questions in the sky',
    cueQuery: 'Showing the {n} matching planes in the sky',
    empty: 'No plane carries that question yet.',
    askIt: 'Ask it →',
    unfold: 'Unfold full answer →',
    read: 'Read',
    liveMany: '{n} questions match',
    liveOne: '1 question matches',
    liveNone: 'No questions match',
    yoursAnswered: '{n} of yours answered'
  },

  waiting: {
    kicker: 'Sent in',
    title: 'Waiting for an answer',
    note: 'Questions people have asked here, without names. IEX answers them here.',
    cue: 'Showing waiting questions in the sky',
    hover: 'Waiting for IEX',
    sent: 'sent {ago}',
    yours: 'yours',
    yoursReview: 'yours · in review',
    inReview: '+ {n} in review',
    empty: 'Nothing waiting yet.',
    emptyAsk: '✎ Be the first to ask'
  },

  ask: {
    kicker: 'A new question',
    title: 'What do you want to know?',
    reassure: [
      'No name, no email, no account.',
      'Asking here doesn’t file a report or start an investigation.',
      'Questions are reviewed before they’re posted, and anything that could identify someone is removed.'
    ],
    label: 'Your question',
    placeholder: 'Write it the way you’d ask a friend…',
    counter: '{n} / {max}',
    pii: 'This might identify someone. You can keep it general.',
    similar: 'Others asked something similar',
    topics: 'Topic (optional)',
    topicList: ['Reporting', 'Privacy', 'Support', 'Process', 'Something else'],
    send: 'Fold & send',
    sending: 'Folding…',
    cancel: 'Cancel',
    discardQ: 'Discard this question?',
    discard: 'Discard',
    keep: 'Keep writing',
    tooShort: 'A few more words, so it reads as a question.',
    failed: 'That didn’t send. Try again in a moment.'
  },

  sent: {
    kicker: 'Sent',
    title: 'Your question is in the air.',
    body: 'It’ll appear here once it’s reviewed, and IEX will answer it here. Your plane is marked on this device so you can find it again.',
    see: 'See it in the sky',
    another: 'Ask another',
    talk: 'Talk to someone now',
    live: 'Your question was sent. It will appear once it has been reviewed.'
  },

  contact: {
    title: 'Talk to someone now',
    lead: 'IEX · Office for Institutional Equity and Title IX',
    email: 'institutionalequity@cmu.edu',
    phone: '(412) 268-7125',
    hours: 'Office hours: weekdays (exact hours to confirm with IEX)',
    urgent: 'In danger right now? Call 911. For confidential support, Counseling & Psychological Services (CaPS) is at 412-268-2922.'
  },

  sky: { unfold: 'unfold', tap: 'tap to unfold', waiting: 'waiting for IEX', yours: 'your question' },

  ago: { now: 'just now', min: '{n} min ago', hour: '1 hour ago', hours: '{n} hours ago', day: '1 day ago', days: '{n} days ago' }
};
