import React, { useState } from 'react';

// PRISMA 2020 Checklist Items
const PRISMA_ITEMS = {
  title: {
    section: 'TITLE',
    items: [
      {
        id: '1',
        item: 'Title',
        description: 'Identify the report as a systematic review.',
      },
    ],
  },
  abstract: {
    section: 'ABSTRACT',
    items: [
      {
        id: '2',
        item: 'Abstract',
        description: 'See the PRISMA 2020 for Abstracts checklist.',
      },
    ],
  },
  introduction: {
    section: 'INTRODUCTION',
    items: [
      {
        id: '3',
        item: 'Rationale',
        description: 'Describe the rationale for the review in the context of existing knowledge.',
      },
      {
        id: '4',
        item: 'Objectives',
        description: 'Provide an explicit statement of the objective(s) or question(s) the review addresses.',
      },
    ],
  },
  methods: {
    section: 'METHODS',
    items: [
      {
        id: '5',
        item: 'Eligibility criteria',
        description: 'Specify the inclusion and exclusion criteria for the review and how studies were grouped for the syntheses.',
      },
      {
        id: '6',
        item: 'Information sources',
        description: 'Specify all databases, registers, websites, organisations, reference lists and other sources searched or consulted to identify studies. Specify the date when each source was last searched or consulted.',
      },
      {
        id: '7',
        item: 'Search strategy',
        description: 'Present the full search strategies for all databases, registers and websites, including any filters and limits used.',
      },
      {
        id: '8',
        item: 'Selection process',
        description: 'Specify the methods used to decide whether a study met the inclusion criteria of the review, including how many reviewers screened each record and each report retrieved, whether they worked independently, and if applicable, details of automation tools used in the process.',
      },
      {
        id: '9',
        item: 'Data collection process',
        description: 'Specify the methods used to collect data from reports, including how many reviewers collected data from each report, whether they worked independently, any processes for obtaining or confirming data from study investigators, and if applicable, details of automation tools used in the process.',
      },
      {
        id: '10a',
        item: 'Data items',
        description: 'List and define all outcomes for which data were sought. Specify whether all results that were compatible with each outcome domain in each study were sought (e.g. for all measures, time points, analyses), and if not, the methods used to decide which results to collect.',
      },
      {
        id: '10b',
        item: 'Data items',
        description: 'List and define all other variables for which data were sought (e.g. participant and intervention characteristics, funding sources). Describe any assumptions made about any missing or unclear information.',
      },
      {
        id: '11',
        item: 'Study risk of bias assessment',
        description: 'Specify the methods used to assess risk of bias in the included studies, including details of the tool(s) used, how many reviewers assessed each study and whether they worked independently, and if applicable, details of automation tools used in the process.',
      },
      {
        id: '12',
        item: 'Effect measures',
        description: 'Specify for each outcome the effect measure(s) (e.g. risk ratio, mean difference) used in the synthesis or presentation of results.',
      },
      {
        id: '13a',
        item: 'Synthesis methods',
        description: 'Describe the processes used to decide which studies were eligible for each synthesis (e.g. tabulating the study intervention characteristics and comparing against the planned groups for each synthesis (item #5)).',
      },
      {
        id: '13b',
        item: 'Synthesis methods',
        description: 'Describe any methods required to prepare the data for presentation or synthesis, such as handling of missing summary statistics, or data conversions.',
      },
      {
        id: '13c',
        item: 'Synthesis methods',
        description: 'Describe any methods used to tabulate or visually display results of individual studies and syntheses.',
      },
      {
        id: '13d',
        item: 'Synthesis methods',
        description: 'Describe any methods used to synthesize results and provide a rationale for the choice(s). If meta-analysis was performed, describe the model(s), method(s) to identify the presence and extent of statistical heterogeneity, and software package(s) used.',
      },
      {
        id: '13e',
        item: 'Synthesis methods',
        description: 'Describe any methods used to explore possible causes of heterogeneity among study results (e.g. subgroup analysis, meta-regression).',
      },
      {
        id: '13f',
        item: 'Synthesis methods',
        description: 'Describe any sensitivity analyses conducted to assess robustness of the synthesized results.',
      },
      {
        id: '14',
        item: 'Reporting bias assessment',
        description: 'Describe any methods used to assess risk of bias due to missing results in a synthesis (arising from reporting biases).',
      },
      {
        id: '15',
        item: 'Certainty assessment',
        description: 'Describe any methods used to assess certainty (or confidence) in the body of evidence for an outcome.',
      },
    ],
  },
  results: {
    section: 'RESULTS',
    items: [
      {
        id: '16a',
        item: 'Study selection',
        description: 'Describe the results of the search and selection process, from the number of records identified in the search to the number of studies included in the review, ideally using a flow diagram.',
      },
      {
        id: '16b',
        item: 'Study selection',
        description: 'Cite studies that might appear to meet the inclusion criteria, but which were excluded, and explain why they were excluded.',
      },
      {
        id: '17',
        item: 'Study characteristics',
        description: 'Cite each included study and present its characteristics.',
      },
      {
        id: '18',
        item: 'Risk of bias in studies',
        description: 'Present assessments of risk of bias for each included study.',
      },
      {
        id: '19',
        item: 'Results of individual studies',
        description: 'For all outcomes, present, for each study: (a) summary statistics for each group (where appropriate) and (b) an effect estimate and its precision (e.g. confidence/credible interval), ideally using structured tables or plots.',
      },
      {
        id: '20a',
        item: 'Results of syntheses',
        description: 'For each synthesis, briefly summarise the characteristics and risk of bias among contributing studies.',
      },
      {
        id: '20b',
        item: 'Results of syntheses',
        description: 'Present results of all statistical syntheses conducted. If meta-analysis was done, present for each the summary estimate and its precision (e.g. confidence/credible interval) and measures of statistical heterogeneity. If comparing groups, describe the direction of the effect.',
      },
      {
        id: '20c',
        item: 'Results of syntheses',
        description: 'Present results of all investigations of possible causes of heterogeneity among study results.',
      },
      {
        id: '20d',
        item: 'Results of syntheses',
        description: 'Present results of all sensitivity analyses conducted to assess the robustness of the synthesized results.',
      },
      {
        id: '21',
        item: 'Reporting biases',
        description: 'Present assessments of risk of bias due to missing results (arising from reporting biases) for each synthesis assessed.',
      },
      {
        id: '22',
        item: 'Certainty of evidence',
        description: 'Present assessments of certainty (or confidence) in the body of evidence for each outcome assessed.',
      },
    ],
  },
  discussion: {
    section: 'DISCUSSION',
    items: [
      {
        id: '23a',
        item: 'Discussion',
        description: 'Provide a general interpretation of the results in the context of other evidence.',
      },
      {
        id: '23b',
        item: 'Discussion',
        description: 'Discuss any limitations of the evidence included in the review.',
      },
      {
        id: '23c',
        item: 'Discussion',
        description: 'Discuss any limitations of the review processes used.',
      },
      {
        id: '23d',
        item: 'Discussion',
        description: 'Discuss implications of the results for practice, policy, and future research.',
      },
    ],
  },
  other: {
    section: 'OTHER INFORMATION',
    items: [
      {
        id: '24a',
        item: 'Registration and protocol',
        description: 'Provide registration information for the review, including register name and registration number, or state that the review was not registered.',
      },
      {
        id: '24b',
        item: 'Registration and protocol',
        description: 'Indicate where the review protocol can be accessed, or state that a protocol was not prepared.',
      },
      {
        id: '24c',
        item: 'Registration and protocol',
        description: 'Describe and explain any amendments to information provided at registration or in the protocol.',
      },
      {
        id: '25',
        item: 'Support',
        description: 'Describe sources of financial or non-financial support for the review, and the role of the funders or sponsors in the review.',
      },
      {
        id: '26',
        item: 'Competing interests',
        description: 'Declare any competing interests of review authors.',
      },
      {
        id: '27',
        item: 'Availability of data, code and other materials',
        description: 'Report which of the following are publicly available and where they can be found: template data collection forms; data extracted from included studies; data used for all analyses; analytic code; any other materials used in the review.',
      },
    ],
  },
};

interface ChecklistItem {
  id: string;
  item: string;
  description: string;
}

interface ChecklistState {
  [key: string]: {
    completed: boolean;
    location: string;
    notes: string;
  };
}

interface PRISMAChecklistProps {
  initialState?: ChecklistState;
  onSave?: (state: ChecklistState) => void;
  readOnly?: boolean;
}

const PRISMAChecklist: React.FC<PRISMAChecklistProps> = ({
  initialState = {},
  onSave,
  readOnly = false,
}) => {
  const [state, setState] = useState<ChecklistState>(initialState);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['title', 'abstract', 'introduction'])
  );

  // Calculate progress
  const allItems = Object.values(PRISMA_ITEMS).flatMap((section) => section.items);
  const completedCount = allItems.filter((item) => state[item.id]?.completed).length;
  const progress = Math.round((completedCount / allItems.length) * 100);

  // Toggle section
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Update item
  const updateItem = (id: string, field: 'completed' | 'location' | 'notes', value: boolean | string) => {
    const newState = {
      ...state,
      [id]: {
        ...state[id],
        completed: state[id]?.completed || false,
        location: state[id]?.location || '',
        notes: state[id]?.notes || '',
        [field]: value,
      },
    };
    setState(newState);
  };

  // Export to CSV
  const exportCSV = () => {
    const rows = [
      ['Section', 'Item #', 'Item', 'Description', 'Completed', 'Location', 'Notes'],
    ];

    Object.entries(PRISMA_ITEMS).forEach(([key, section]) => {
      section.items.forEach((item) => {
        rows.push([
          section.section,
          item.id,
          item.item,
          `"${item.description.replace(/"/g, '""')}"`,
          state[item.id]?.completed ? 'Yes' : 'No',
          state[item.id]?.location || '',
          state[item.id]?.notes || '',
        ]);
      });
    });

    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prisma_checklist.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Section colors
  const sectionColors: Record<string, string> = {
    title: 'blue',
    abstract: 'blue',
    introduction: 'green',
    methods: 'yellow',
    results: 'orange',
    discussion: 'purple',
    other: 'slate',
  };

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50">
      {/* Header */}
      <div className="p-5 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">PRISMA 2020 Checklist</h2>
            <p className="text-sm text-slate-400 mt-1">
              Track compliance with all 27 PRISMA items
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm text-slate-400">
                {completedCount}/{allItems.length}
              </span>
            </div>
            {/* Export */}
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Export CSV
            </button>
            {/* Save */}
            {onSave && !readOnly && (
              <button
                onClick={() => onSave(state)}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="divide-y divide-slate-700/50">
        {Object.entries(PRISMA_ITEMS).map(([key, section]) => {
          const color = sectionColors[key] || 'slate';
          const isExpanded = expandedSections.has(key);
          const sectionCompleted = section.items.filter((item) => state[item.id]?.completed).length;

          return (
            <div key={key}>
              {/* Section Header */}
              <button
                onClick={() => toggleSection(key)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-${color}-400 font-semibold text-sm`}>
                    {section.section}
                  </span>
                  <span className="text-xs text-slate-500">
                    {sectionCompleted}/{section.items.length} completed
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Items */}
              {isExpanded && (
                <div className="px-5 pb-4 space-y-3">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-lg border ${
                        state[item.id]?.completed
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-slate-900/30 border-slate-700/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <label className="flex items-center mt-0.5">
                          <input
                            type="checkbox"
                            checked={state[item.id]?.completed || false}
                            onChange={(e) => updateItem(item.id, 'completed', e.target.checked)}
                            disabled={readOnly}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-900/50 text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
                          />
                        </label>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-500">#{item.id}</span>
                            <span className="font-medium text-white">{item.item}</span>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">{item.description}</p>

                          {/* Location input */}
                          <div className="mt-3 flex gap-3">
                            <div className="flex-1">
                              <label className="block text-xs text-slate-500 mb-1">
                                Location in manuscript
                              </label>
                              <input
                                type="text"
                                value={state[item.id]?.location || ''}
                                onChange={(e) => updateItem(item.id, 'location', e.target.value)}
                                placeholder="e.g., Methods, p.5"
                                disabled={readOnly}
                                className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-white text-sm placeholder:text-slate-600"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs text-slate-500 mb-1">Notes</label>
                              <input
                                type="text"
                                value={state[item.id]?.notes || ''}
                                onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                                placeholder="Additional notes"
                                disabled={readOnly}
                                className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-white text-sm placeholder:text-slate-600"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700/50 text-center">
        <p className="text-xs text-slate-500">
          Based on: Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement. BMJ 2021;372:n71.{' '}
          <a
            href="https://doi.org/10.1136/bmj.n71"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300"
          >
            doi:10.1136/bmj.n71
          </a>
        </p>
      </div>
    </div>
  );
};

export default PRISMAChecklist;
export { PRISMA_ITEMS };
export type { ChecklistState };
