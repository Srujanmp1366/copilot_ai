import { BaseAgent } from './BaseAgent.js';
import { askGeminiJSON, isGeminiAvailable } from '../config/gemini.js';

export class RoadmapAgent extends BaseAgent {
  constructor() {
    super('Roadmap Agent', '🗺️', '#f97316');
  }

  async run(input) {
    const { eligibilityResults, schemes, businessDetails, documentChecklist } = input;
    const eligibleSchemes = eligibilityResults
      .filter(r => r.status === 'eligible' || r.status === 'partially_eligible')
      .map(r => r.schemeName);

    const schemeLinks = schemes
      .filter(s => eligibleSchemes.includes(s.name))
      .map(s => ({ name: s.name, url: s.websiteUrl || s.applyLink || '' }));

    const missingDocs = documentChecklist?.categories?.flatMap(c => c.documents.filter(d => !d.likelyAvailable)) || [];
    const missingDocNames = missingDocs.map(d => d.name);

    if (isGeminiAvailable()) {
      try {
        const prompt = `You are an application roadmap planner for Indian government funding schemes.

Business: ${businessDetails.businessType} in ${businessDetails.state}, age ${businessDetails.startupAge} years.

Eligible schemes: ${eligibleSchemes.join(', ')}
Scheme Links (use these in actionItems or description): ${schemeLinks.map(l => `${l.name}: ${l.url}`).join(', ')}
Missing Documents to acquire: ${missingDocNames.join(', ') || 'None'}

Create a step-by-step action roadmap to apply for these schemes. Be practical and specific.
If there are missing documents, create a phase to acquire them. Provide actual scheme links in application steps. Add a field "relatedDocument" with the exact document name if a step is about acquiring a missing document. Add a field "link" if a step involves a portal.

Return JSON:
{
  "totalSteps": 8,
  "estimatedTotalDays": 45,
  "phases": [
    {
      "phase": 1, "title": "Phase Title", "duration": "Week 1-2",
      "steps": [
        { "step": 1, "title": "Step title", "description": "What to do", "actionItems": ["action 1"], "estimatedDays": 3, "difficulty": "easy", "tips": "helpful tip", "relatedDocument": "Document Name (if applicable)", "link": "https://... (if applicable)" }
      ]
    }
  ],
  "reminders": [{ "title": "Reminder", "dueIn": "7 days", "description": "What to remember" }],
  "quickWins": ["Things that can be done immediately"]
}`;
        return await askGeminiJSON(prompt);
      } catch (e) {
        console.log('RoadmapAgent falling back to template roadmap');
      }
    }

    // Template fallback
    let currentStep = 4;
    const docSteps = missingDocs.map((doc) => ({
      step: currentStep++,
      title: `Obtain ${doc.name}`,
      description: `You need this document to apply. ${doc.howToGet || ''}`,
      actionItems: ['Check issuing authority', 'Apply/request document', 'Keep digital copy ready'],
      estimatedDays: parseInt(doc.estimatedTime) || 3,
      difficulty: doc.priority === 'high' ? 'hard' : 'medium',
      tips: 'Start early as this might take time',
      relatedDocument: doc.name
    }));

    const applicationSteps = eligibleSchemes.map((schemeName) => {
      const link = schemeLinks.find(l => l.name === schemeName)?.url;
      return {
        step: currentStep++,
        title: `Apply for ${schemeName}`,
        description: 'Submit application for this scheme',
        actionItems: ['Visit scheme portal', 'Fill application form', 'Upload all documents', 'Submit and note application ID'],
        estimatedDays: 2,
        difficulty: 'medium',
        tips: 'Double check all documents before submitting',
        link: link
      };
    });

    const phases = [
      {
        phase: 1, title: 'Registration & Compliance', duration: 'Week 1',
        steps: [
          { step: 1, title: 'Complete Udyam Registration', description: 'Register your business on the Udyam portal to get MSME classification', actionItems: ['Visit udyamregistration.gov.in', 'Keep Aadhaar and PAN ready', 'Fill business details and submit'], estimatedDays: 1, difficulty: 'easy', tips: 'This is free and instant — do it today!', link: 'https://udyamregistration.gov.in' },
          { step: 2, title: 'Get GST Registration', description: 'Apply for GSTIN if not already registered', actionItems: ['Visit gst.gov.in', 'Submit required documents', 'Complete verification'], estimatedDays: 3, difficulty: 'medium', tips: 'Required for most government schemes', link: 'https://gst.gov.in' },
          { step: 3, title: 'Apply for DPIIT Recognition', description: 'Get Startup India recognition if applicable', actionItems: ['Visit startupindia.gov.in', 'Complete the application', 'Upload proof of innovation'], estimatedDays: 3, difficulty: 'medium', tips: 'This unlocks startup-specific schemes', link: 'https://startupindia.gov.in' }
        ]
      }
    ];

    if (docSteps.length > 0) {
      phases.push({
        phase: 2, title: 'Document Preparation', duration: 'Week 2',
        steps: docSteps
      });
    }

    phases.push({
      phase: phases.length + 1, title: 'Application Submission', duration: 'Week 3-4',
      steps: applicationSteps.length > 0 ? applicationSteps : [
        { step: currentStep, title: 'Prepare Business Plan / Pitch Deck', description: 'Create a compelling business plan for scheme applications', actionItems: ['Write executive summary', 'Detail market opportunity', 'Include financial projections'], estimatedDays: 5, difficulty: 'hard', tips: 'Focus on impact and innovation' }
      ]
    });

    return {
      totalSteps: currentStep - 1,
      estimatedTotalDays: 30,
      phases: phases,
      reminders: [
        { title: 'Complete Udyam Registration', dueIn: '2 days', description: 'This is the quickest win — do it first' },
        { title: 'Check Application Status', dueIn: '14 days', description: 'Follow up on submitted applications' },
        { title: 'Document Expiry Check', dueIn: '30 days', description: 'Ensure all documents are current and valid' }
      ],
      quickWins: [
        'Register on Udyam portal today (free, instant)',
        'Create account on Startup India portal',
        'Download bank statement from online banking',
        'Start drafting your business plan outline'
      ]
    };
  }
}
