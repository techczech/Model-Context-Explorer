/* Context Explorer: scripted scenarios.
   Data only. app.js builds the context at every step from these events.
   All conversations, files, websites and figures are invented examples.

   Scenario fields
     system, instructions{file,text}, tools[], toolsNote, toolsTokens, skills[], window
     turns[]: { choices[], lesson, events[] }
   Event kinds
     think   {text, secs}
     tool    {name, args, result, title, kind:'tool'|'search', chips[], type, resultTokens, excerpt}
     sub     {name, task, summary, steps[], sub:{blocks[]}}
     compact {text, tokens, note}
     answer  {text, quote, widget}
   "tokens" overrides the rough count (characters / 4) where the text shown is an excerpt of a larger real block.
*/
window.SCENARIOS = [

/* ------------------------------------------------------------ 1 */
{
  id: 'chat',
  title: 'Plain chat',
  short: 'A conversation with no tools. Only the history grows.',
  blurb: 'No tools and no files. The context is the system prompt plus every message so far.',
  window: 200000,
  system: "You are a helpful assistant for office and knowledge work. Write in plain British English. Keep answers short unless asked for more. If you are not sure, say so.\n\nToday's date: 16 November 2026.",
  turns: [
    {
      choices: [
        "I need to write a short update for my director about our website migration. Where do I start?",
        "Help me write a progress update on the website migration for my director.",
        "My director wants an update on the website migration. How should I plan it?"
      ],
      lesson: "First turn. The model receives the system prompt and your message, nothing else.",
      events: [
        { k: 'answer', text: "Start with three things: who will read it, what has happened since the last update, and what you need from them. Directors often decide from the first two lines, so lead with the status and the decision you need.\n\nWhat is the current status, and do you need anything from your director?" }
      ]
    },
    {
      choices: [
        "It is about 70% done and two weeks late because the old search tool broke. I need a decision on extra budget.",
        "70% complete, two weeks behind after the old search failed. I am asking for more budget."
      ],
      lesson: "The model does not remember turn 1. Your first message and its own first reply are sent again, followed by the new message.",
      events: [
        { k: 'answer', text: "Then the update has three parts: status (70% complete, two weeks late), cause (the old search tool failed and has to be rebuilt) and the request (a decision on extra budget). Put the request in the opening line so it is not missed.\n\nShall I draft it? It would help to know roughly how much you need." }
      ]
    },
    {
      choices: [
        "Draft it in under 120 words. The extra budget is £4,000.",
        "Go on, draft it. Keep it under 120 words and ask for £4,000."
      ],
      lesson: "'It' means the update only because the earlier turns are in the context. Four messages are now being resent.",
      events: [
        { k: 'answer', text: "Here is a draft of 96 words.",
          quote: "Subject: Website migration: decision needed on £4,000\n\nDear [Director],\n\nI need a decision from you this week on £4,000 of extra budget for the website migration.\n\nThe migration is about 70% complete and two weeks behind schedule. The old search tool failed in testing and has to be rebuilt, not moved across. The other pages are unaffected.\n\nWith the budget we can bring in a contractor for the search rebuild and hold a revised launch date. Without it, the delay is likely to grow to four weeks.\n\nI can talk this through at any time.\n\n[Name]" }
      ]
    },
    {
      choices: [
        "Make it warmer and shorter, but keep the budget request.",
        "Shorter and friendlier please. The £4,000 request must stay."
      ],
      lesson: "'The budget request' is found in the earlier draft, which is part of this context. Nothing is stored anywhere else.",
      events: [
        { k: 'answer', text: "Here is a shorter version of 64 words.",
          quote: "Dear [Director],\n\nThe website migration is about 70% complete and two weeks behind, because the old search tool failed in testing and has to be rebuilt.\n\nCould you approve £4,000 this week for a contractor to rebuild it? That would hold a revised launch date. Without it, the delay may reach four weeks.\n\nThank you, and I am happy to talk it through.\n\n[Name]" }
      ]
    }
  ]
},

/* ------------------------------------------------------------ 2 */
{
  id: 'web',
  title: 'Web search agent',
  short: 'The agent decides to search, reads a page and cites its sources.',
  blurb: 'Tool definitions sit in the context. The model writes a search call, the harness runs it, and the results come back as more context.',
  window: 200000,
  system: "You are a research assistant with access to the web. Search before you answer anything that may have changed or that you cannot know. Cite sources by number, for example [1]. Say when sources disagree or are thin. Write in British English.\n\nToday's date: 16 November 2026.",
  tools: [
    { name: 'web_search', description: 'Search the web. Returns up to max_results results with a title, URL and short snippet.',
      input_schema: { type: 'object', properties: { query: { type: 'string' }, max_results: { type: 'integer', default: 5 } }, required: ['query'] } },
    { name: 'fetch_url', description: 'Fetch a web page and return its text.',
      input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } }
  ],
  turns: [
    {
      choices: [
        "Find venues in Edinburgh that could hold a 150-person conference in March, and roughly what they cost.",
        "I am organising a 150-person conference in Edinburgh in March. Which venues are there and what do they cost?"
      ],
      lesson: "The model cannot know current prices, so it asks the harness to search. Each result is pasted into the context before the next step.",
      events: [
        { k: 'think', secs: 3, text: "Prices and availability change, so I should search rather than answer from memory. I need venues that seat 150 and a price for each." },
        { k: 'tool', kind: 'search', name: 'web_search', title: 'Searched the web',
          args: { query: 'conference venues Edinburgh 150 delegates March 2027 hire cost', max_results: 5 },
          chips: ['canongateconf.example', 'assemblyrooms-edinburgh.example', 'leithwarehouse.example', 'oldcollege-events.example', 'venuefinder.example'],
          result:
"[1] Hall B, Canongate Conference Centre\nhttps://canongateconf.example/hire/hall-b\nSeats up to 180 theatre-style. Day delegate rate from £42 per person with refreshments and lunch.\n\n[2] The Thistle Rooms, Edinburgh\nhttps://assemblyrooms-edinburgh.example/ballroom\nBallroom seats 150 theatre-style. Room hire £3,900 per day; catering quoted separately. Four minutes from Waverley station.\n\n[3] Shore Street Warehouse Venue\nhttps://leithwarehouse.example/events\nFlexible floor space for 100 to 250. Hire from £2,800 a day; bring your own caterer.\n\n[4] Northgate College lecture theatre hire\nhttps://oldcollege-events.example/theatre\nTiered seating for 160. Weekday rate £1,500. Subject to term-time availability.\n\n[5] Eight Edinburgh conference venues compared (2025 prices)\nhttps://venuefinder.example/edinburgh-conference-venues\nA round-up of venues with last year's rates." },
        { k: 'think', secs: 2, text: "Result 1 is the only one with a per-person price, and it is close to what was asked. I will read that page to get the full terms." },
        { k: 'tool', kind: 'tool', name: 'fetch_url', title: 'Read a web page',
          args: { url: 'https://canongateconf.example/hire/hall-b' },
          chips: ['canongateconf.example/hire/hall-b'],
          resultTokens: 2900, excerpt: true,
          result:
"Hall B, Canongate Conference Centre\n\nCapacity: 180 theatre, 120 cabaret, 90 boardroom.\nRate: £42 per delegate per day (minimum 100 delegates), including arrival tea and coffee, lunch and an afternoon break. Screens, microphones and wifi included.\nAccess: step-free entrance from Holyrood Road, lift to all floors, hearing loop in Hall B.\nLocation: 12 minutes' walk from Waverley station. Bus stops outside.\nBooking: provisional holds last 14 days. Enquiries: events@canongateconf.example" },
        { k: 'answer',
          text: "Four venues could take 150 people. Their prices are quoted in different ways, so they are not directly comparable:\n\n- Hall B, Canongate Conference Centre [1]: £42 per delegate per day with lunch, so about £6,300 for 150.\n- The Thistle Rooms [2]: £3,900 a day for the room; catering extra.\n- Shore Street Warehouse [3]: from £2,800 a day; you arrange catering.\n- Northgate College lecture theatre [4]: £1,500 on weekdays, depending on term dates.\n\nI read only the Hall B page in full. The other prices come from search snippets. The comparison article [5] uses 2025 prices, so I left it out." }
      ]
    },
    {
      choices: [
        "Which of those are step-free and close to Waverley station?",
        "Which have step-free access, and how far are they from the station?"
      ],
      lesson: "No new search. The earlier results and the Hall B page are still in the context, so the model answers from them. Anything it did not read, it cannot tell you.",
      events: [
        { k: 'think', secs: 2, text: "The Hall B page covers access and distance. The Thistle Rooms snippet gives distance only. I have not opened the others, so I should say so and not guess." },
        { k: 'answer',
          text: "From what I have read:\n\n- Hall B [1] has a step-free entrance, lifts and a hearing loop. It is a 12-minute walk from Waverley.\n- The Thistle Rooms [2] are closest, at four minutes, but the snippet says nothing about access.\n\nI have not opened the other pages, so I cannot say for the rest. I can check the Thistle Rooms page if you like." }
      ]
    },
    {
      choices: [
        "Check whether Hall B is free on 12 March.",
        "Is Hall B available on 12 March?"
      ],
      lesson: "A new fact is needed, so the model makes a second tool call. Both pages and all earlier results are still in the context, and so is the new one.",
      events: [
        { k: 'think', secs: 2, text: "The Hall B page may link to an availability calendar. The URL pattern suggests /availability, so I will fetch that." },
        { k: 'tool', kind: 'tool', name: 'fetch_url', title: 'Read a web page',
          args: { url: 'https://canongateconf.example/hire/hall-b/availability' },
          chips: ['canongateconf.example/hire/hall-b/availability'],
          resultTokens: 1700, excerpt: true,
          result:
"Hall B availability, March 2027\n\nAvailable: 3, 4, 5, 9, 10, 18, 19\nBooked: 11, 15, 16, 17, 22, 23, 24, 25, 26\nProvisional hold (another client, until 20 November): 12" },
        { k: 'answer',
          text: "Hall B is not free on 12 March yet [1]. Another client holds it provisionally until 20 November. If that hold lapses, it will be available again.\n\nThe nearest free dates are 9 and 10 March, and 18 and 19 March. Provisional holds on this site last 14 days, so you could place your own hold today." }
      ]
    }
  ]
},

/* ------------------------------------------------------------ 3 */
{
  id: 'files',
  title: 'Working with files',
  short: 'The agent looks in folders, searches and reads whole files.',
  blurb: 'Instead of being handed a few snippets, the agent finds its own way through your files. Whatever it reads becomes context.',
  window: 200000,
  system: "You are a workspace assistant with access to the user's files. Find files yourself: list folders and search before you read. Read only what you need. Quote file names. Do not change files unless asked. Write in British English.\n\nWorkspace root: ~/Work\nToday's date: 16 November 2026.",
  tools: [
    { name: 'list_dir', description: 'List the files and folders in a directory.',
      input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'grep', description: 'Search file contents for a regular expression. Returns file, line number and line.',
      input_schema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, ignore_case: { type: 'boolean' } }, required: ['pattern', 'path'] } },
    { name: 'read_file', description: 'Read a whole text file.',
      input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'search_library', description: 'Semantic search over the shared document library. Returns the top_k best-matching passages with a score.',
      input_schema: { type: 'object', properties: { query: { type: 'string' }, top_k: { type: 'integer', default: 3 } }, required: ['query'] } }
  ],
  turns: [
    {
      choices: [
        "What did we decide about keeping the survey data? I need two lines for the board paper.",
        "Summarise our decision on keeping the survey data, in two lines, for the board paper."
      ],
      lesson: "The agent has no file attached. It lists a folder, searches it, then reads the two files that matter. Both files now sit in the context in full.",
      events: [
        { k: 'think', secs: 2, text: "This sounds like the records review project. I will look at that folder first, then search the notes for the decision." },
        { k: 'tool', kind: 'tool', name: 'list_dir', title: 'Looked in a folder',
          args: { path: '~/Work/records-review' },
          chips: ['records-review/'],
          result: "notes/            6 files\ndrafts/           3 files\nREADME.md\nretention-policy-2024.pdf\nsurvey-2026-raw.csv" },
        { k: 'tool', kind: 'search', name: 'grep', title: 'Searched the notes',
          args: { pattern: 'retention|keep the survey data', path: '~/Work/records-review/notes', ignore_case: true },
          chips: ['6 files searched', '5 matches'],
          result:
"notes/2026-09-14-retention-options.md:3:  # Records review: retention options\nnotes/2026-09-14-retention-options.md:9:  Legal view (from Tom): the 2026 consent form promised deletion \"within 12 months\".\nnotes/2026-10-12-retention-decision.md:1:  # Records review: retention decision\nnotes/2026-10-12-retention-decision.md:4:  Decision: keep identifiable survey responses for 12 months ...\nnotes/2026-11-02-board-prep.md:5:  Board paper needs the retention wording." },
        { k: 'think', secs: 2, text: "The October file records the decision and the September file has the options and the legal reason. I will read both in full so I do not miss a condition." },
        { k: 'tool', kind: 'search', name: 'read_file', title: 'Read 2 files',
          args: { path: '~/Work/records-review/notes/2026-10-12-retention-decision.md' },
          chips: ['2026-10-12-retention-decision.md'],
          resultTokens: 2600, excerpt: true,
          result:
"# Records review: retention decision\nDate: 12 October 2026. Present: Amara (chair), Tom, Priya.\n\nDecision: keep identifiable survey responses for 12 months from the survey close date, then delete them. Keep the anonymised dataset for 5 years.\n\nWhy: the 2026 consent form promised deletion within 12 months (see 14 September notes). A 3-year period would need re-consent, which Tom estimated at six weeks with a low response.\n\nActions:\n- Priya to add a deletion date to the survey register by 30 October (done)\n- Tom to confirm the anonymisation method with the data protection officer by 20 November (open)\n- Amara to put the wording in the board paper" },
        { k: 'tool', kind: 'search', name: 'read_file', title: 'Read 2 files',
          args: { path: '~/Work/records-review/notes/2026-09-14-retention-options.md' },
          chips: ['2026-09-14-retention-options.md'],
          resultTokens: 1900, excerpt: true,
          result:
"# Records review: retention options\nDate: 14 September 2026. Present: Amara, Tom, Priya.\n\nOptions:\n1. Keep for 12 months, then delete.\n2. Keep for 3 years, to compare with the 2029 survey.\n3. Delete after analysis (about 3 months).\n\nLegal view (from Tom): the 2026 consent form promised deletion \"within 12 months\". Option 2 needs re-consent.\n\nNo decision taken. Priya to cost anonymising the data so a longer-term copy can be kept." },
        { k: 'answer',
          text: "For the board paper:",
          quote: "Identifiable survey responses will be kept for 12 months from the survey close date, then deleted, as the consent form promised. An anonymised dataset will be kept for 5 years.",
          after: "Source: notes/2026-10-12-retention-decision.md, with the options in notes/2026-09-14-retention-options.md. One action is still open: Tom is to confirm the anonymisation method with the data protection officer by 20 November." }
      ]
    },
    {
      choices: [
        "Which actions are still open across all the notes?",
        "List every action that is still open in those notes."
      ],
      lesson: "The two files from turn 1 are still in the context, but they cover only part of the folder. The agent searches again to cover all of it, and only the matching lines come back.",
      events: [
        { k: 'think', secs: 2, text: "The two files I read only cover retention. Actions are marked (open) or (done), so I can search all the notes for (open)." },
        { k: 'tool', kind: 'search', name: 'grep', title: 'Searched the notes',
          args: { pattern: '\\(open\\)', path: '~/Work/records-review/notes' },
          chips: ['6 files searched', '3 matches'],
          result:
"notes/2026-08-10-interviews.md:14:  - Priya to send interview summary to Amara by 21 August (open)\nnotes/2026-10-12-retention-decision.md:12:  - Tom to confirm the anonymisation method with the data protection officer by 20 November (open)\nnotes/2026-11-02-board-prep.md:7:  - Amara to draft the board paper wording by 9 November (open)" },
        { k: 'answer',
          text: "Three actions are marked open:\n\n- Priya: send the interview summary to Amara by 21 August. This is long overdue and may simply not have been marked done.\n- Tom: confirm the anonymisation method with the data protection officer by 20 November.\n- Amara: draft the board paper wording by 9 November. This is a week overdue.\n\nI have not read the full notes for the first and third, only the lines above." }
      ]
    },
    {
      choices: [
        "Suppose we had used a snippet search over the whole library instead. What would it have given you?",
        "Try it the snippet way: pull the best passages on retention from the library and tell me what you would miss."
      ],
      lesson: "The old way, retrieval: the system picks a few short passages for you. It is much smaller than reading whole files, but the agent only sees what ranked highest.",
      events: [
        { k: 'think', secs: 2, text: "I will run the library search for the same topic and compare what comes back with what I read from the files." },
        { k: 'tool', kind: 'search', name: 'search_library', title: 'Searched the library',
          args: { query: 'survey data retention decision', top_k: 3 },
          chips: ['3 passages'],
          type: 'retrieved', resultTokens: 260,
          result:
"[0.82] retention-policy-2024.pdf, p.3\n\"Research data should be kept for no longer than is necessary for the stated purpose, and not beyond any period promised to participants.\"\n\n[0.79] records-review/notes/2026-09-14-retention-options.md\n\"Options: 1. Keep for 12 months, then delete. 2. Keep for 3 years, to compare with the 2029 survey. 3. Delete after analysis.\"\n\n[0.71] faq-data.docx\n\"How long do we keep survey responses? Usually 12 months, unless the project has agreed otherwise.\"" },
        { k: 'answer',
          text: "The snippet search returned three passages, about 260 tokens. Reading the two files cost about 4,500.\n\nThe snippets found the options and the general policy, but not the decision. The October notes did not rank in the top three. A reader relying on them might report option 1 or 2 as undecided, and would miss the 5-year anonymised copy and the open action.\n\nSnippets are cheaper and work across a large library. Reading whole files costs more context but keeps the answer next to the reasons and the conditions." }
      ]
    }
  ]
},

/* ------------------------------------------------------------ 4 */
{
  id: 'data',
  title: 'Data analysis',
  short: 'The agent finds a spreadsheet, writes code, and draws a chart.',
  blurb: 'The model does not calculate in its head. It writes code, the harness runs it, and the code and its output both become context.',
  window: 200000,
  system: "You are a data analyst with a Python sandbox and file access. Find the data yourself. Show your working by running code; never calculate in your head. Check column names and missing values before you analyse. Report numbers with units. Write in British English.",
  tools: [
    { name: 'find_files', description: 'Find files by name pattern under a folder.',
      input_schema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern'] } },
    { name: 'run_python', description: 'Run Python in a persistent sandbox with pandas and matplotlib. Variables stay between calls. Returns printed output.',
      input_schema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } }
  ],
  turns: [
    {
      choices: [
        "Which region grew fastest between Q2 and Q3? Make me a chart.",
        "Which of our regions grew fastest from Q2 to Q3? Show it as a chart."
      ],
      lesson: "Three model steps: find the file, inspect it, calculate. Each code block and each output is added to the context, so the third step can build on the first two.",
      events: [
        { k: 'think', secs: 2, text: "I do not know where the sales data is. I will search for a sales spreadsheet." },
        { k: 'tool', kind: 'search', name: 'find_files', title: 'Looked for files',
          args: { pattern: '*sales*.xlsx', path: '~/Work' },
          chips: ['3 files found'],
          result: "~/Work/finance/sales-2026-q3.xlsx          6 Nov 2026   48 KB\n~/Work/finance/sales-2025-q3.xlsx          4 Nov 2025   45 KB\n~/Work/archive/sales-2026-q3-DRAFT.xlsx   21 Oct 2026  41 KB" },
        { k: 'think', secs: 2, text: "The finance folder has the current final version. The archive copy is a draft. I will check its sheets and columns before calculating anything." },
        { k: 'tool', kind: 'tool', name: 'run_python', title: 'Ran code',
          args: { code: "import pandas as pd\nsheets = pd.read_excel('~/Work/finance/sales-2026-q3.xlsx', sheet_name=None)\nfor name, sheet in sheets.items():\n    print(name, sheet.shape)\n    print(sheet.head(3).to_string())" },
          result: "Sales (45, 5)\n       region channel quarter  units  sales_gbp_k\n0  North West  Online      Q1    610           24\n1  North West  Online      Q2    790           32\n2  North West  Online      Q3   1280           53\nNotes (3, 1)\n                                       text\n0  All figures in £ thousands, excluding VAT.\n1  Q3 includes the September promotion.\n2  Channels: Online, Retail, Trade." },
        { k: 'tool', kind: 'tool', name: 'run_python', title: 'Ran code',
          args: { code: "d = sheets['Sales']\nt = d.pivot_table(index='region', columns='quarter', values='sales_gbp_k', aggfunc='sum')\nt['growth_pct'] = ((t['Q3'] / t['Q2'] - 1) * 100).round(1)\nprint(t[['Q2', 'Q3', 'growth_pct']].sort_values('growth_pct', ascending=False))" },
          result: "quarter      Q2    Q3  growth_pct\nregion\nMidlands    388   451        16.2\nNorth West  412   448         8.7\nSouth East  655   701         7.0\nScotland    240   252         5.0\nWales       131   128        -2.3" },
        { k: 'answer',
          text: "The Midlands grew fastest: up 16.2%, from £388k to £451k. Across all regions sales rose 8.4%, from £1,826k to £1,980k. Wales is the only region that fell, by 2.3%.\n\nThe spreadsheet notes say Q3 includes the September promotion, so some of this growth may be temporary. The chart below is live: switch between growth and Q3 sales.",
          widget: { type: 'chart', title: 'Sales by region, Q2 to Q3',
            note: '£ thousands, from sales-2026-q3.xlsx (invented data)',
            series: [
              { name: 'Growth', unit: '%', data: [['Midlands', 16.2], ['North West', 8.7], ['South East', 7.0], ['Scotland', 5.0], ['Wales', -2.3]] },
              { name: 'Q3 sales', unit: '£k', data: [['South East', 701], ['Midlands', 451], ['North West', 448], ['Scotland', 252], ['Wales', 128]] }
            ] } }
      ]
    },
    {
      choices: [
        "Leave out the Online channel and show me again.",
        "Does the answer change if we exclude online sales?"
      ],
      lesson: "The agent reuses the variables it created earlier, because the sandbox keeps them. The earlier code and output are still in the context, so it can refer to them.",
      events: [
        { k: 'think', secs: 2, text: "The data is already loaded as d. I only need to filter out the Online rows and repeat the same calculation." },
        { k: 'tool', kind: 'tool', name: 'run_python', title: 'Ran code',
          args: { code: "r = d[d['channel'] != 'Online']\nt2 = r.pivot_table(index='region', columns='quarter', values='sales_gbp_k', aggfunc='sum')\nt2['growth_pct'] = ((t2['Q3'] / t2['Q2'] - 1) * 100).round(1)\nprint(t2[['Q2', 'Q3', 'growth_pct']].sort_values('growth_pct', ascending=False))" },
          result: "quarter      Q2    Q3  growth_pct\nregion\nMidlands    301   362        20.3\nNorth West  380   395         3.9\nSouth East  540   558         3.3\nScotland    205   206         0.5\nWales       118   112        -5.1" },
        { k: 'answer',
          text: "The Midlands is still first, and by more: 20.3% without Online. Elsewhere growth slows sharply. The North West falls from 8.7% to 3.9%, and Scotland is almost flat. So most of the growth outside the Midlands came from Online.",
          widget: { type: 'chart', title: 'Sales by region excluding Online, Q2 to Q3',
            note: '£ thousands, Retail and Trade only (invented data)',
            series: [
              { name: 'Growth', unit: '%', data: [['Midlands', 20.3], ['North West', 3.9], ['South East', 3.3], ['Scotland', 0.5], ['Wales', -5.1]] },
              { name: 'Q3 sales', unit: '£k', data: [['South East', 558], ['North West', 395], ['Midlands', 362], ['Scotland', 206], ['Wales', 112]] }
            ] } }
      ]
    },
    {
      choices: [
        "Save that chart as a PNG next to the spreadsheet.",
        "Save this chart as an image in the finance folder."
      ],
      lesson: "A short turn. The agent can write the file because the code, the data and the folder path are all in the context from earlier turns.",
      events: [
        { k: 'tool', kind: 'tool', name: 'run_python', title: 'Ran code',
          args: { code: "import matplotlib.pyplot as plt\nax = t2['growth_pct'].sort_values().plot.barh(color='#2f6fae')\nax.set_xlabel('Growth, Q2 to Q3 (%), excluding Online')\nax.figure.tight_layout()\nax.figure.savefig('~/Work/finance/growth-ex-online-q3.png', dpi=150)\nprint('saved')" },
          result: "saved" },
        { k: 'answer',
          text: "Saved as growth-ex-online-q3.png in ~/Work/finance, next to the spreadsheet. It shows growth without Online. I have not opened the image to check how it looks." }
      ]
    }
  ]
},

/* ------------------------------------------------------------ 5 */
{
  id: 'skills',
  title: 'Instructions, skills and sub-agents',
  short: 'Standing instructions, skills loaded on demand, and a helper with its own context.',
  blurb: 'An instruction file is always in context. A skill costs a line until it is needed. A sub-agent works in its own small context and returns only a summary.',
  window: 200000,
  system: "You are a writing and research assistant working in the user's project folder. Follow the instruction file. Load a skill only when the task needs it. Use a sub-agent for checks that would fill this chat with detail. Write in British English.",
  instructions: {
    file: 'AGENTS.md',
    text: "# AGENTS.md: Library Board project\n\n## House style\n- British spelling. Plain sentences. Explain any acronym.\n- Board papers are one page, with the decision needed in the first line.\n\n## Files\n- Source notes: board-papers/oct/notes/\n- Finance figures: finance/q3-library-costs.xlsx (read only)\n- Drafts go in board-papers/drafts/. Never edit board-papers/final/.\n\n## Skills\n- Use the board-briefing skill for any board paper or briefing.\n- Use the figure-check skill, in a sub-agent, to check figures against a spreadsheet."
  },
  tools: [
    { name: 'read_file', description: 'Read a whole text file.',
      input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'write_file', description: 'Write a text file. Creates folders if needed.',
      input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
    { name: 'spawn_subagent', description: 'Start a sub-agent with a fresh context and one task. It returns a short summary only.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, task: { type: 'string' } }, required: ['name', 'task'] } }
  ],
  skills: [
    ['board-briefing', 'Write one-page briefings for the Library Board: structure, tone and length.'],
    ['meeting-minutes', 'Turn rough notes into minutes with actions and owners.'],
    ['figure-check', 'Check figures in a draft against source spreadsheets.'],
    ['plain-english', 'Rewrite text at a reading age of 12 without losing meaning.'],
    ['slide-outline', 'Outline a short talk as slides with one point each.']
  ],
  turns: [
    {
      choices: [
        "Draft the Library Board briefing from the October notes.",
        "Write the briefing for the Library Board using the October notes."
      ],
      lesson: "AGENTS.md and the skill list were in context before you typed. Only one skill, board-briefing, is opened. The other four cost a line each.",
      events: [
        { k: 'think', secs: 2, text: "AGENTS.md says to use board-briefing for board papers. The skill list shows where it is. I will load it before I write anything." },
        { k: 'tool', kind: 'tool', name: 'read_file', title: 'Loaded skill: board-briefing',
          args: { path: '.agents/skills/board-briefing/SKILL.md' },
          chips: ['board-briefing/SKILL.md'],
          type: 'skill', resultTokens: 1100, excerpt: true,
          result:
"---\nname: board-briefing\ndescription: Write one-page briefings for the Library Board.\n---\n# Board briefing\n\n1. First line: the decision needed, in one sentence.\n2. Then three short parts: Background (three sentences at most), Options (two or three, each with its cost), Recommendation.\n3. One page: 350 words at most. Give figures in £ with the source in brackets.\n4. End with the meeting date and who will speak.\n\nDo not add appendices. Explain any acronym." },
        { k: 'think', secs: 2, text: "Now the source notes. AGENTS.md says they are in board-papers/oct/notes/." },
        { k: 'tool', kind: 'search', name: 'read_file', title: 'Read a file',
          args: { path: 'board-papers/oct/notes/2026-10-board-prep.md' },
          chips: ['2026-10-board-prep.md'],
          resultTokens: 1800, excerpt: true,
          result:
"Library Board, 27 November. Speaker: Maya.\n\nIssue: reading-room hours. Open 9 to 5 on weekdays. Students ask for evenings.\nOption A: stay as now (£0).\nOption B: open until 8pm Monday to Thursday all year (+£18,400 a year in staffing).\nOption C: open until 8pm in term time only (+£11,200 a year).\nTrial in October, two weeks of 8pm opening: average 64 visitors per evening.\nMaya favours C." },
        { k: 'answer',
          text: "Here is the draft, following the skill's structure (83 words).",
          quote:
"Decision needed: whether to open the reading room until 8pm in term time, at an extra £11,200 a year.\n\nBackground: the reading room closes at 5pm on weekdays and students have asked for evening hours. A two-week trial in October averaged 64 visitors per evening.\n\nOptions:\nA. Keep current hours (£0).\nB. Open until 8pm Monday to Thursday all year (+£18,400 a year).\nC. Open until 8pm in term time only (+£11,200 a year).\n\nRecommendation: option C.\n\nBoard meeting 27 November. Speaker: Maya." }
      ]
    },
    {
      choices: [
        "Check the figures in the draft against the finance spreadsheet, without filling this chat with detail.",
        "Have something else check the draft's figures against finance/q3-library-costs.xlsx."
      ],
      lesson: "A sub-agent starts with a fresh context holding only its task. It reads a large spreadsheet that never enters this chat. Only its short summary comes back. Use the tabs to compare the two contexts.",
      events: [
        { k: 'think', secs: 2, text: "AGENTS.md says to check figures in a sub-agent. The spreadsheet could be large, so a sub-agent keeps this chat small. I will give it the three figures and the file path." },
        { k: 'sub', name: 'figure-checker',
          task: "Check these figures from the draft against finance/q3-library-costs.xlsx: £18,400 (option B, extra staffing per year), £11,200 (option C, extra staffing per year), 64 average evening visitors. Report any that do not match. Reply in under 80 words.",
          summary: "Two figures need attention. £18,400 matches the row 'Evening staffing, Mon-Thu, all year'. The term-time cost is £11,900, not £11,200: the spreadsheet adds £700 for security cover that the notes leave out. The 64 visitors figure is not in the spreadsheet; it comes from the notes only.",
          steps: [
            "Read finance/q3-library-costs.xlsx (about 5,200 tokens of rows)",
            "Compared the three figures with the rows for evening staffing",
            "Wrote an 80-word summary and returned it"
          ],
          sub: { blocks: [
            { type: 'system', label: 'System prompt (sub-agent)', text: "You are a sub-agent. Do the task you are given, using the tools provided. When done, reply with a short summary only: no preamble, under 80 words.\n\nBe exact about figures, and say if one cannot be found." },
            { type: 'tools', label: 'Tool definitions (sub-agent)', text: JSON.stringify([{ name: 'read_file', description: 'Read a whole text file.', input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } }], null, 2) },
            { type: 'user', label: 'Task from the main agent', text: "Check these figures from the draft against finance/q3-library-costs.xlsx: £18,400 (option B, extra staffing per year), £11,200 (option C, extra staffing per year), 64 average evening visitors. Report any that do not match. Reply in under 80 words." },
            { type: 'call', label: 'Tool call · read_file', text: JSON.stringify({ name: 'read_file', arguments: { path: 'finance/q3-library-costs.xlsx' } }, null, 2) },
            { type: 'result', label: 'Tool result · read_file', excerpt: true, tokens: 5200,
              text: "Sheet: Costs Q3\nCost line                              Q3 actual   Annual basis\nEvening staffing, Mon-Thu, all year     4,600       18,400\nEvening staffing, term time only        2,975       11,200\nSecurity cover, evening, term time      175         700\nEvening staffing + security, term       3,150       11,900\nUtilities (evening uplift)              410         1,640\n..." }
          ] } },
        { k: 'answer',
          text: "The checker found one problem. The notes give £11,200 for term-time evenings, but the finance spreadsheet says £11,900, because it includes £700 for security cover. The £18,400 figure matches. The 64 visitors figure is in the notes only.\n\nI have not changed the draft yet. Shall I use £11,900?" }
      ]
    },
    {
      choices: [
        "Yes, use £11,900 and save the draft in board-papers/drafts.",
        "Use £11,900 and save it to the drafts folder."
      ],
      lesson: "The sub-agent's whole working is gone. Only the summary from the last turn is in this context, and that is all the model needs.",
      events: [
        { k: 'tool', kind: 'tool', name: 'write_file', title: 'Saved a file',
          args: { path: 'board-papers/drafts/library-board-briefing.md', content: "Decision needed: whether to open the reading room until 8pm in term time, at an extra £11,900 a year (staffing and security: finance/q3-library-costs.xlsx).\n\n[Background, options and recommendation as in the draft, with option C updated to £11,900.]" },
          chips: ['library-board-briefing.md'],
          result: "Wrote 156 words to board-papers/drafts/library-board-briefing.md" },
        { k: 'answer',
          text: "Saved to board-papers/drafts/library-board-briefing.md. Option C now reads £11,900 a year, with the source named. I left board-papers/final/ alone, as AGENTS.md says." }
      ]
    }
  ]
},

/* ------------------------------------------------------------ 6 */
{
  id: 'long',
  title: 'Long session',
  short: 'The window fills up. The harness compacts old turns into a summary.',
  blurb: 'A context window is finite. When it nears the limit, the harness asks the model to summarise older turns and replaces them. Detail is lost.',
  window: 200000,
  system: "You are an editorial assistant working in the user's project folder. Follow the instruction file. Read before you rewrite. Write in British English.",
  instructions: {
    file: 'AGENTS.md',
    text: "# AGENTS.md: Intranet clean-up\n\n- Source: intranet-export/ (60 pages, HTML). Style guide: style/style-guide.txt\n- Rewrites go in rewrites/. Never edit intranet-export/.\n- British spelling, plain sentences, one idea per paragraph."
  },
  tools: [
    { name: 'list_dir', description: 'List the files and folders in a directory.',
      input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'read_file', description: 'Read a whole text file.',
      input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'read_files', description: 'Read several text files at once.',
      input_schema: { type: 'object', properties: { paths: { type: 'array', items: { type: 'string' } } }, required: ['paths'] } },
    { name: 'write_file', description: 'Write a text file.',
      input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } }
  ],
  toolsNote: "Shown: 4 of 14 tool definitions. The rest are omitted here.",
  toolsTokens: 6200,
  turns: [
    {
      choices: [
        "Audit the exported intranet pages in intranet-export/ and list the ones that need rewriting.",
        "Go through all 60 intranet pages and tell me which need rewriting."
      ],
      lesson: "Reading 60 pages at once puts about 58,000 tokens into the context in one step. Tool results and files are what fill a window.",
      events: [
        { k: 'tool', kind: 'tool', name: 'list_dir', title: 'Looked in a folder',
          args: { path: 'intranet-export' }, chips: ['60 pages'],
          resultTokens: 700, excerpt: true,
          result: "page-01.html  page-02.html  page-03.html  page-04.html\npage-05.html  page-06.html  page-07.html  page-08.html\n...\npage-57.html  page-58.html  page-59.html  page-60.html" },
        { k: 'tool', kind: 'search', name: 'read_files', title: 'Read 60 files',
          args: { paths: ['intranet-export/page-01.html', 'intranet-export/page-02.html', '... 58 more paths'] },
          chips: ['page-01.html', 'page-02.html', '58 more'],
          resultTokens: 58000, excerpt: true,
          result: "=== page-01.html ===\n<h1>Booking a meeting room</h1>\n<p>Rooms are booked through the Facilities Portal (see the 2019 guide) ...</p>\n\n=== page-02.html ===\n<h1>Expenses</h1>\n<p>Claims must be submitted on form EX-4 within 30 days ...</p>\n\n... 58 more pages" },
        { k: 'answer',
          text: "17 of the 60 pages need rewriting:\n\n- 9 are out of date, for example page 01 refers to a 2019 booking guide.\n- 5 contradict another page, such as pages 02 and 31 on expense deadlines.\n- 3 have no named owner and no review date.\n\nShall I rank them against the style guide?" }
      ]
    },
    {
      choices: [
        "Compare those 17 with the style guide and rank them by how far they are from it.",
        "Rank the 17 pages by how far they are from our style guide."
      ],
      lesson: "The 60 pages are still in the context. The style guide adds another 41,000 tokens on top. Nothing is dropped yet.",
      events: [
        { k: 'tool', kind: 'tool', name: 'read_file', title: 'Read a file',
          args: { path: 'style/style-guide.txt' }, chips: ['style-guide.txt'],
          resultTokens: 41000, excerpt: true,
          result: "Intranet style guide, version 4\n\n1. Write for someone who has 30 seconds.\n2. Put the action first: 'Book a room', not 'Room booking procedures'.\n3. One idea per paragraph. Sentences under 25 words.\n4. Every page names an owner and a review date.\n...\n(see the full text for 38 more rules and examples)" },
        { k: 'answer',
          text: "Ranked from furthest to closest to the style guide:\n\npage-11, 04, 22, 31, 08, 17, 39, 52, 05, 14, 26, 33, 40, 45, 48, 55, 59.\n\nThe worst three: page-11 (leave policy) has 1,284 words, no owner and passive sentences throughout. Page-04 (expenses) contradicts page-31 and has sentences over 40 words. Page-22 (IT help) is out of date and has no review date." }
      ]
    },
    {
      choices: [
        "Write a rewrite brief for each of the eight worst pages.",
        "For the eight worst pages, write a brief saying what to change."
      ],
      lesson: "Another 52,000 tokens of earlier page versions. The context is now above 80% of the window, close to the limit.",
      events: [
        { k: 'tool', kind: 'search', name: 'read_files', title: 'Read 8 files',
          args: { paths: ['intranet-export/history/page-11-v1.html', 'intranet-export/history/page-11-v2.html', '... 14 more paths'] },
          chips: ['page-11 history', 'page-04 history', '6 more'],
          resultTokens: 52000, excerpt: true,
          result: "=== history/page-11-v1.html ===\n<h1>Leave</h1> ...\n\n=== history/page-11-v2.html ===\n<h1>Annual leave policy</h1> ...\n\n... 14 more files" },
        { k: 'answer',
          text: "Here are the eight briefs, each with the problem, the change and the owner to ask:\n\n1. page-11: split into annual leave, sick leave and parental leave. Ask HR for an owner.\n2. page-04: resolve with page-31, then rewrite in short sentences. Ask Finance.\n3. page-22: update to the 2026 help desk process.\n\nThe remaining five are in the same format." }
      ]
    },
    {
      choices: [
        "Start the rewrite with the first page in the ranking.",
        "Begin rewriting page 11."
      ],
      lesson: "The context passes the limit that triggers compaction. The model is asked to write a summary, and the harness swaps the old turns for it. Use the Before and After tabs.",
      events: [
        { k: 'compact', note: 'Context passed 80% of the window.',
          text:
"Summary of the session so far\n\nTask: audit the 60 intranet pages in intranet-export/, rank those needing rewrite against style/style-guide.txt, and rewrite them into rewrites/.\n\nFindings: 17 of 60 pages need rewriting (9 out of date, 5 contradicting another page, 3 with no owner or review date).\nRanking, worst first: page-11, 04, 22, 31, 08, 17, 39, 52, 05, 14, 26, 33, 40, 45, 48, 55, 59.\n\nKey rules from the style guide: put the action first; sentences under 25 words; one idea per paragraph; every page names an owner and a review date.\n\nBriefs agreed: page-11 split into three pages (annual leave, sick leave, parental leave); page-04 to be reconciled with page-31 before rewriting.\n\nNext step: rewrite page-11.",
          tokens: 2400 },
        { k: 'think', secs: 2, text: "The summary says page-11 comes first and that the style guide wants the action first. I do not have the page text any more, so I will read it again." },
        { k: 'tool', kind: 'tool', name: 'read_file', title: 'Read a file',
          args: { path: 'intranet-export/page-11.html' }, chips: ['page-11.html'],
          resultTokens: 3100, excerpt: true,
          result: "<h1>Leave</h1>\n<p>Employees are entitled to leave in accordance with the provisions of the policy, which should be read in conjunction with ...</p>\n..." },
        { k: 'answer',
          text: "Here is the opening of the rewrite for annual leave. The sick leave and parental leave pages will follow in the same format.",
          quote: "Annual leave: how to book it\n\nYou get 27 days a year plus bank holidays. To book leave, ask your manager in the HR system at least two weeks ahead.\n\nOwner: HR. Next review: 1 June 2027." }
      ]
    },
    {
      choices: [
        "What was the exact word count of page 11 before we started?",
        "How many words was the original page 11?"
      ],
      lesson: "The cost of compaction. Exact details that did not make it into the summary are gone. The agent has to read the file again, or admit it does not know.",
      events: [
        { k: 'think', secs: 2, text: "My summary does not give the word count. A figure I made up would be worse than no figure, so I will check the file." },
        { k: 'tool', kind: 'tool', name: 'read_file', title: 'Read a file',
          args: { path: 'intranet-export/page-11.html' }, chips: ['page-11.html'],
          resultTokens: 3100, excerpt: true,
          result: "<h1>Leave</h1>\n<p>Employees are entitled to leave in accordance with the provisions of the policy, which should be read in conjunction with ...</p>\n..." },
        { k: 'answer',
          text: "The original page 11 has 1,284 words. I had to read the file again, because my summary of the earlier work said only that the page was too long. Details that were not in the summary are not available to me any more. Anything exact that you will need later is worth asking me to keep in a file." }
      ]
    }
  ]
}
];
