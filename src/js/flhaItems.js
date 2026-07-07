// Mirrors the HCR "Work Site / Lift Hazard Assessment & Tool Box Meeting Report" paper form.
// Each item: id (matches paper form numbering), text, and whether it needs a free-text field
// instead of / in addition to the Safe/Risk checkboxes.

export const FLHA_CATEGORIES = [
  {
    name: 'Protective Equipment & Personnel',
    items: [
      { id: 1, text: 'Use Proper PPE in Good Condition' },
      { id: 2, text: 'Crane Operator Certification' },
      { id: 3, text: '3-Point Contact to Climb / Descend' },
      { id: 4, text: 'Lifting - Bend Knees Not Lower Back' },
      { id: 5, text: 'Do Not Over Exert / Ask For Help' },
      { id: 6, text: "Use Fall Arrest Protection (Over 6')" },
      { id: 7, text: 'Assess Crush Points & Crane Swing Radii' },
      { id: 8, text: 'Devise Escape / Emergency Response Plan' },
      { id: 9, text: 'Designate a Qualified Signalman', hasName: true },
      { id: 10, text: "H2S Cert. & H2S Monitors (As Req'd)" },
      { id: 11, text: 'Violence & Harassment' }
    ]
  },
  {
    name: 'Atmospheric Conditions',
    items: [
      { id: 12, text: "Cold Conditions / De-rate Chart as Req'd." },
      { id: 13, text: 'Assess Wind Direction / Wind Force' },
      { id: 14, text: 'Remove Snow / Ice Accumulations' },
      { id: 15, text: 'Suspend Operations in Lightning' },
      { id: 16, text: 'Assess Fog & Visibility Concerns' },
      { id: 17, text: 'Assess Rain & Moisture Concerns' },
      { id: 18, text: 'Wind Speed', freeTextOnly: true, unit: 'km/h' }
    ]
  },
  {
    name: 'Environmental Conditions',
    items: [
      { id: 19, text: 'Assess Sun or Bright Lights Shining into the Crane Cab' },
      { id: 20, text: 'All Crane Operations Must Stop if Operator Loses Site of Load' },
      { id: 21, text: 'Once Guns Have Been Confirmed as Fired, Radio Communication Must be Made By the Ground Crews With Crane Operator Before Any Crane Movement Starts' }
    ]
  },
  {
    name: 'Ground & Crane Stability',
    items: [
      { id: 22, text: 'Check Ground Voids (Culverts / Tanks / Pipes)' },
      { id: 23, text: 'Check Excavations (1 to 1 Slope Minimum)' },
      { id: 24, text: 'Assess Ground Conditions Soft / Uneven / Rough' },
      { id: 25, text: 'Apply Outriggers & Stabilizers @ 90%' },
      { id: 26, text: 'Ensure Crane Pads & Floats Are Used and Use Crane Matting (As Req\'d)' },
      { id: 27, text: 'Watch For Slippery Ground' },
      { id: 28, text: 'Set-Up Crane Level on Each Axis / Off Rubber' },
      { id: 29, text: 'Blocking - Stack Tightly / Securely' }
    ]
  },
  {
    name: 'Rigging',
    items: [
      { id: 30, text: 'Select Correct Load Anchor / Pick Points' },
      { id: 31, text: 'Secure Loose Load Parts & Protect Rigging Over Sharp Edges' },
      { id: 32, text: "Inspect Rigging For Wear & Component I.D. Tags. (Remove From Service)" },
      { id: 33, text: 'Select Rigging to Maximize Capacity & Reduce Sling Angles' },
      { id: 34, text: 'Secure Shackle Bolts to Avoid Them From Backing Off' },
      { id: 35, text: 'Select Rigging To Maintain Load Center of Gravity' },
      { id: 36, text: 'Use Only Certified Spreader Beams & Man Baskets' },
      { id: 37, text: '2 Sling Loops Per Hook or Large Shackle for More' },
      { id: 38, text: 'Review and Discuss Hoisting Procedures for Man Baskets' }
    ]
  },
  {
    name: 'Hoisting Practices & Set-Up',
    items: [
      { id: 39, text: 'Ensure Crane Pre-Operating Inspection is Completed' },
      { id: 40, text: 'Practice Good Housekeeping' },
      { id: 41, text: 'Position Crane(s) to Maximize Capacity @ Working Radius' },
      { id: 42, text: 'Ensure That Working Radii and Charted Capacities are Not Exceeded' },
      { id: 43, text: 'Clear Unauthorized Personnel From Lift Zone - Install Barricades & Tags' },
      { id: 44, text: 'Signalman in Full View or Dedicated 2-Way Radio Communication' },
      { id: 45, text: 'Operate Slow & Smooth - Reduce Dynamic Loading - Avoid Shock Loads' },
      { id: 46, text: 'Check Load is Free to Hoist & Perform and Record a Test Lift' },
      { id: 47, text: 'Maintain Sling Pressure Until Loads are in Position & Secured' },
      { id: 48, text: 'Never Ride Loads / Boom / Hook & Use Tag Lines to Control Loads' },
      { id: 49, text: 'Stay Out from Under Overhead Loads Unless Unavoidable' }
    ]
  },
  {
    name: "Written Lift Plans & Lift Evaluation Report Requirements",
    items: [
      { id: 50, text: 'Power Line Proximity - Record a Lift Evaluation - Post a Safety Watcher' },
      { id: 51, text: "Multi Crane Lifts - Perform a Lift Evaluation & Written Lift Plan Req'd. If any Crane Capacity Ratings Exceed 75%" },
      { id: 52, text: "Live Gas Plant / Pipes (Lift Ev. Report & Engineered Lift Plan Req'd By Owner)" },
      { id: 53, text: "Complete a Lift Evaluation Report Where Required Crane Capacity Exceeds 75% & Engineered Lift Plan For +90% Capacity Requirements" },
      { id: 54, text: "Perform Tool Box Meeting & Review Lift Plans With Req'd Personnel" }
    ]
  }
];

export const CRANE_SETUP_CHANGES = ['Crane Set Up # 2', 'Crane Set Up # 3', 'Crane Set Up # 4'];
