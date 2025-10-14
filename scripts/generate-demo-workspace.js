#!/usr/bin/env node

/**
 * Generate Demo Workspace
 * Creates a comprehensive demo workspace with 1000+ Wikipedia-style pages
 * Organized by subjects with proper wiki links, kanban boards, and canvases
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEMO_PATH = '/Users/pratham/Programming/Lokud Dir/Lokus-Demo';

// Subject categories with topics
const SUBJECTS = {
  'Science': {
    'Physics': ['Quantum Mechanics', 'General Relativity', 'Thermodynamics', 'Electromagnetism', 'Classical Mechanics', 'Special Relativity', 'Particle Physics', 'Nuclear Physics', 'Optics', 'Acoustics', 'Fluid Dynamics', 'Solid State Physics', 'Plasma Physics', 'Astrophysics', 'Cosmology', 'String Theory', 'Dark Matter', 'Dark Energy', 'Higgs Boson', 'Standard Model', 'Quantum Field Theory', 'Statistical Mechanics', 'Condensed Matter Physics', 'Atomic Physics', 'Molecular Physics'],
    'Chemistry': ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry', 'Analytical Chemistry', 'Biochemistry', 'Quantum Chemistry', 'Electrochemistry', 'Polymer Chemistry', 'Environmental Chemistry', 'Green Chemistry', 'Medicinal Chemistry', 'Theoretical Chemistry', 'Computational Chemistry', 'Nuclear Chemistry', 'Photochemistry', 'Supramolecular Chemistry', 'Catalysis', 'Chemical Kinetics', 'Thermochemistry', 'Spectroscopy', 'Crystallography', 'Nanochemistry', 'Materials Chemistry', 'Surface Chemistry', 'Coordination Chemistry'],
    'Biology': ['Cell Biology', 'Molecular Biology', 'Genetics', 'Evolution', 'Ecology', 'Microbiology', 'Botany', 'Zoology', 'Anatomy', 'Physiology', 'Neuroscience', 'Immunology', 'Developmental Biology', 'Marine Biology', 'Biochemistry', 'Biotechnology', 'Bioinformatics', 'Systems Biology', 'Synthetic Biology', 'Epigenetics', 'Genomics', 'Proteomics', 'Virology', 'Mycology', 'Entomology'],
    'Mathematics': ['Algebra', 'Calculus', 'Geometry', 'Topology', 'Number Theory', 'Set Theory', 'Logic', 'Graph Theory', 'Combinatorics', 'Probability Theory', 'Statistics', 'Differential Equations', 'Linear Algebra', 'Abstract Algebra', 'Real Analysis', 'Complex Analysis', 'Functional Analysis', 'Discrete Mathematics', 'Numerical Analysis', 'Game Theory', 'Category Theory', 'Chaos Theory', 'Fractal Geometry', 'Algebraic Geometry', 'Differential Geometry'],
    'Computer Science': ['Algorithms', 'Data Structures', 'Artificial Intelligence', 'Machine Learning', 'Deep Learning', 'Computer Vision', 'Natural Language Processing', 'Databases', 'Operating Systems', 'Computer Networks', 'Cybersecurity', 'Cryptography', 'Software Engineering', 'Web Development', 'Mobile Development', 'Cloud Computing', 'Distributed Systems', 'Blockchain', 'Quantum Computing', 'Computer Graphics', 'Human-Computer Interaction', 'Compiler Design', 'Theory of Computation', 'Robotics', 'Information Theory'],
    'Astronomy': ['Solar System', 'Planets', 'Stars', 'Galaxies', 'Black Holes', 'Neutron Stars', 'Supernovae', 'Nebulae', 'Comets', 'Asteroids', 'Exoplanets', 'Cosmology', 'Big Bang Theory', 'Cosmic Microwave Background', 'Gravitational Waves', 'Pulsars', 'Quasars', 'Galaxy Clusters', 'Dark Matter', 'Dark Energy', 'Stellar Evolution', 'Planetary Formation', 'Astrobiology', 'Space Exploration', 'Telescopes']
  },
  'History': {
    'Ancient History': ['Ancient Egypt', 'Ancient Greece', 'Ancient Rome', 'Mesopotamia', 'Indus Valley Civilization', 'Ancient China', 'Mayan Civilization', 'Aztec Empire', 'Inca Empire', 'Phoenicia', 'Carthage', 'Persian Empire', 'Alexander the Great', 'Julius Caesar', 'Cleopatra', 'Spartacus', 'Hammurabi', 'Ramses II', 'Tutankhamun', 'Socrates', 'Plato', 'Aristotle', 'Homer', 'Virgil', 'Hannibal'],
    'Medieval History': ['Byzantine Empire', 'Holy Roman Empire', 'Crusades', 'Feudalism', 'Viking Age', 'Norman Conquest', 'Magna Carta', 'Black Death', 'Hundred Years War', 'Joan of Arc', 'Genghis Khan', 'Mongol Empire', 'Ottoman Empire', 'Medieval China', 'Medieval Japan', 'Samurai', 'Knights Templar', 'Charlemagne', 'Richard the Lionheart', 'Saladin', 'Marco Polo', 'Medieval Universities', 'Gothic Architecture', 'Romanesque Architecture', 'Medieval Music'],
    'Modern History': ['Renaissance', 'Protestant Reformation', 'Scientific Revolution', 'Age of Exploration', 'Colonialism', 'Industrial Revolution', 'French Revolution', 'American Revolution', 'Napoleonic Wars', 'World War I', 'World War II', 'Cold War', 'Civil Rights Movement', 'Space Race', 'Fall of Berlin Wall', 'Decolonization', 'European Union', 'Globalization', 'Digital Revolution', 'Arab Spring', 'Climate Change Movement', 'Pandemic Response', 'Information Age', 'Post-Cold War Era', 'War on Terror'],
    'American History': ['Colonial America', 'American Revolution', 'Constitution', 'Civil War', 'Reconstruction', 'Westward Expansion', 'Progressive Era', 'Great Depression', 'New Deal', 'Pearl Harbor', 'Civil Rights Movement', 'Vietnam War', 'Watergate', 'Ronald Reagan', 'September 11 Attacks', 'Barack Obama', 'Donald Trump', 'Joe Biden', 'Abraham Lincoln', 'George Washington', 'Thomas Jefferson', 'Benjamin Franklin', 'Martin Luther King Jr', 'Rosa Parks', 'Malcolm X'],
    'World History': ['Silk Road', 'Trans-Atlantic Slave Trade', 'Spanish Empire', 'British Empire', 'Russian Revolution', 'Chinese Revolution', 'Indian Independence', 'Partition of India', 'Apartheid', 'Nelson Mandela', 'Mahatma Gandhi', 'Winston Churchill', 'Adolf Hitler', 'Joseph Stalin', 'Mao Zedong', 'United Nations', 'NATO', 'European Union', 'ASEAN', 'African Union', 'League of Nations', 'Treaty of Versailles', 'Yalta Conference', 'Bretton Woods', 'Marshall Plan']
  },
  'Arts': {
    'Visual Arts': ['Painting', 'Sculpture', 'Drawing', 'Photography', 'Printmaking', 'Digital Art', 'Installation Art', 'Performance Art', 'Video Art', 'Street Art', 'Renaissance Art', 'Baroque Art', 'Impressionism', 'Expressionism', 'Cubism', 'Surrealism', 'Abstract Art', 'Pop Art', 'Minimalism', 'Contemporary Art', 'Leonardo da Vinci', 'Michelangelo', 'Vincent van Gogh', 'Pablo Picasso', 'Andy Warhol'],
    'Music': ['Classical Music', 'Jazz', 'Rock Music', 'Pop Music', 'Hip Hop', 'Electronic Music', 'Country Music', 'Blues', 'Folk Music', 'Opera', 'Symphony', 'Chamber Music', 'Baroque Music', 'Romantic Music', 'Modern Music', 'Wolfgang Amadeus Mozart', 'Ludwig van Beethoven', 'Johann Sebastian Bach', 'Frederic Chopin', 'Igor Stravinsky', 'Miles Davis', 'The Beatles', 'Bob Dylan', 'Michael Jackson', 'Madonna'],
    'Literature': ['Poetry', 'Novel', 'Short Story', 'Drama', 'Epic Poetry', 'Sonnet', 'Haiku', 'Science Fiction', 'Fantasy', 'Mystery', 'Romance', 'Thriller', 'Historical Fiction', 'Realism', 'Modernism', 'Postmodernism', 'William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Leo Tolstoy', 'Fyodor Dostoevsky', 'Ernest Hemingway', 'Virginia Woolf', 'James Joyce', 'Gabriel Garcia Marquez'],
    'Film': ['Silent Film', 'Golden Age of Hollywood', 'French New Wave', 'Italian Neorealism', 'Film Noir', 'Science Fiction Film', 'Horror Film', 'Comedy Film', 'Drama Film', 'Action Film', 'Animation', 'Documentary', 'Cinematography', 'Film Editing', 'Sound Design', 'Alfred Hitchcock', 'Stanley Kubrick', 'Martin Scorsese', 'Steven Spielberg', 'Quentin Tarantino', 'Christopher Nolan', 'Akira Kurosawa', 'Ingmar Bergman', 'Federico Fellini', 'Francis Ford Coppola'],
    'Architecture': ['Ancient Architecture', 'Classical Architecture', 'Gothic Architecture', 'Renaissance Architecture', 'Baroque Architecture', 'Neoclassical Architecture', 'Modernism', 'Postmodernism', 'Brutalism', 'Deconstructivism', 'Sustainable Architecture', 'Skyscrapers', 'Frank Lloyd Wright', 'Le Corbusier', 'Ludwig Mies van der Rohe', 'Zaha Hadid', 'Frank Gehry', 'Norman Foster', 'Renzo Piano', 'I. M. Pei', 'Taj Mahal', 'Eiffel Tower', 'Sagrada Familia', 'Burj Khalifa', 'Sydney Opera House']
  },
  'Philosophy': {
    'Ancient Philosophy': ['Socrates', 'Plato', 'Aristotle', 'Pre-Socratic Philosophy', 'Stoicism', 'Epicureanism', 'Cynicism', 'Skepticism', 'Neoplatonism', 'Confucius', 'Laozi', 'Buddhism', 'Hinduism', 'Jainism', 'Theory of Forms', 'The Republic', 'Nicomachean Ethics', 'Metaphysics', 'Logic', 'Ethics', 'Political Philosophy', 'Aesthetics', 'Epistemology', 'Ontology', 'The Analects'],
    'Modern Philosophy': ['Rene Descartes', 'John Locke', 'David Hume', 'Immanuel Kant', 'Georg Wilhelm Friedrich Hegel', 'Karl Marx', 'Friedrich Nietzsche', 'Jean-Paul Sartre', 'Simone de Beauvoir', 'Michel Foucault', 'Rationalism', 'Empiricism', 'Idealism', 'Materialism', 'Phenomenology', 'Existentialism', 'Structuralism', 'Poststructuralism', 'Critical Theory', 'Pragmatism', 'Analytic Philosophy', 'Continental Philosophy', 'Philosophy of Mind', 'Philosophy of Language', 'Philosophy of Science'],
    'Ethics': ['Virtue Ethics', 'Deontology', 'Consequentialism', 'Utilitarianism', 'Kantian Ethics', 'Applied Ethics', 'Bioethics', 'Environmental Ethics', 'Business Ethics', 'Medical Ethics', 'Animal Rights', 'Human Rights', 'Social Justice', 'Distributive Justice', 'Moral Relativism', 'Moral Realism', 'Meta-ethics', 'Normative Ethics', 'Descriptive Ethics', 'Moral Psychology', 'Moral Development', 'Trolley Problem', 'Is-Ought Problem', 'Naturalistic Fallacy', 'Categorical Imperative'],
    'Logic': ['Formal Logic', 'Symbolic Logic', 'Propositional Logic', 'Predicate Logic', 'Modal Logic', 'Temporal Logic', 'Fuzzy Logic', 'Inductive Logic', 'Deductive Logic', 'Abductive Logic', 'Logical Fallacies', 'Syllogism', 'Modus Ponens', 'Modus Tollens', 'Proof Theory', 'Model Theory', 'Set Theory', 'Computability Theory', 'Recursion Theory', 'Lambda Calculus', 'Type Theory', 'Category Theory', 'Constructive Logic', 'Paraconsistent Logic', 'Relevance Logic'],
    'Political Philosophy': ['Democracy', 'Liberalism', 'Conservatism', 'Socialism', 'Communism', 'Anarchism', 'Fascism', 'Feminism', 'Multiculturalism', 'Nationalism', 'Social Contract', 'Natural Rights', 'Civil Liberties', 'Rule of Law', 'Separation of Powers', 'Checks and Balances', 'Representative Democracy', 'Direct Democracy', 'Republicanism', 'Constitutionalism', 'Thomas Hobbes', 'John Locke', 'Jean-Jacques Rousseau', 'John Stuart Mill', 'John Rawls']
  },
  'Technology': {
    'Computing': ['Personal Computer', 'Mainframe', 'Supercomputer', 'Cloud Computing', 'Edge Computing', 'Quantum Computing', 'Internet', 'World Wide Web', 'Search Engines', 'Social Media', 'E-commerce', 'Cryptocurrency', 'Virtual Reality', 'Augmented Reality', 'Internet of Things', 'Big Data', 'Data Science', 'Programming Languages', 'Operating Systems', 'Software Development', 'Agile Methodology', 'DevOps', 'Microservices', 'APIs', 'Web 3.0'],
    'Telecommunications': ['Telegraph', 'Telephone', 'Radio', 'Television', 'Satellite Communication', 'Mobile Phone', 'Smartphone', '5G', '6G', 'Fiber Optics', 'WiFi', 'Bluetooth', 'GPS', 'Cellular Networks', 'Network Protocols', 'TCP/IP', 'HTTP', 'DNS', 'VoIP', 'Video Conferencing', 'Streaming Media', 'Broadband', 'DSL', 'Cable Internet', 'Satellite Internet'],
    'Transportation': ['Automobile', 'Electric Vehicle', 'Autonomous Vehicle', 'High-Speed Rail', 'Hyperloop', 'Aviation', 'Jet Engine', 'Spacecraft', 'Rocket', 'Satellite', 'Submarine', 'Ship', 'Bicycle', 'Motorcycle', 'Maglev Train', 'Drone', 'Air Traffic Control', 'GPS Navigation', 'Traffic Management', 'Urban Planning', 'Public Transportation', 'Mass Transit', 'Sustainable Transportation', 'Transportation Infrastructure', 'Logistics'],
    'Energy': ['Solar Power', 'Wind Power', 'Hydroelectric Power', 'Nuclear Power', 'Fossil Fuels', 'Coal', 'Oil', 'Natural Gas', 'Geothermal Energy', 'Biomass', 'Hydrogen Fuel', 'Battery Technology', 'Energy Storage', 'Smart Grid', 'Power Plant', 'Renewable Energy', 'Energy Efficiency', 'Carbon Capture', 'Nuclear Fusion', 'Thorium Reactor', 'Solar Panel', 'Wind Turbine', 'Hydroelectric Dam', 'Energy Policy', 'Energy Crisis'],
    'Medicine': ['Vaccines', 'Antibiotics', 'Gene Therapy', 'CRISPR', 'Stem Cell Therapy', 'Immunotherapy', 'Chemotherapy', 'Radiation Therapy', 'Surgery', 'Minimally Invasive Surgery', 'Robotic Surgery', 'Telemedicine', 'Medical Imaging', 'MRI', 'CT Scan', 'Ultrasound', 'X-Ray', 'PET Scan', 'Precision Medicine', 'Personalized Medicine', 'Nanomedicine', 'Biotechnology', 'Pharmaceutical Industry', 'Clinical Trials', 'FDA Approval']
  },
  'Geography': {
    'Physical Geography': ['Mountains', 'Rivers', 'Oceans', 'Deserts', 'Forests', 'Tundra', 'Savanna', 'Rainforest', 'Grassland', 'Wetlands', 'Glaciers', 'Volcanoes', 'Earthquakes', 'Plate Tectonics', 'Continental Drift', 'Climate', 'Weather', 'Atmosphere', 'Hydrosphere', 'Lithosphere', 'Biosphere', 'Geomorphology', 'Hydrology', 'Climatology', 'Biogeography'],
    'Human Geography': ['Population', 'Urbanization', 'Migration', 'Cultural Geography', 'Economic Geography', 'Political Geography', 'Agricultural Geography', 'Industrial Geography', 'Transportation Geography', 'Settlement Patterns', 'Demographic Transition', 'Urban Planning', 'Rural Development', 'Globalization', 'Development Geography', 'Environmental Geography', 'Social Geography', 'Historical Geography', 'Regional Geography', 'Geopolitics', 'Border Studies', 'Tourism Geography', 'Health Geography', 'Language Geography', 'Religious Geography'],
    'Continents': ['Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Eurasia', 'Americas', 'Middle East', 'Caribbean', 'Central America', 'Southeast Asia', 'East Asia', 'South Asia', 'Central Asia', 'Western Europe', 'Eastern Europe', 'Northern Europe', 'Southern Europe', 'Sub-Saharan Africa', 'North Africa', 'West Africa', 'East Africa', 'Southern Africa'],
    'Countries': ['United States', 'China', 'India', 'Russia', 'Brazil', 'Japan', 'Germany', 'United Kingdom', 'France', 'Italy', 'Canada', 'Australia', 'Mexico', 'South Korea', 'Spain', 'Indonesia', 'Turkey', 'Saudi Arabia', 'Argentina', 'South Africa', 'Egypt', 'Iran', 'Pakistan', 'Bangladesh', 'Nigeria'],
    'Cities': ['New York City', 'London', 'Tokyo', 'Paris', 'Beijing', 'Shanghai', 'Mumbai', 'São Paulo', 'Mexico City', 'Cairo', 'Moscow', 'Istanbul', 'Lagos', 'Seoul', 'Jakarta', 'Manila', 'Karachi', 'Buenos Aires', 'Los Angeles', 'Chicago', 'Sydney', 'Toronto', 'Berlin', 'Madrid', 'Rome']
  },
  'Economics': {
    'Microeconomics': ['Supply and Demand', 'Market Equilibrium', 'Elasticity', 'Consumer Theory', 'Producer Theory', 'Market Structures', 'Perfect Competition', 'Monopoly', 'Oligopoly', 'Monopolistic Competition', 'Game Theory', 'Price Discrimination', 'Market Failure', 'Externalities', 'Public Goods', 'Information Asymmetry', 'Moral Hazard', 'Adverse Selection', 'Principal-Agent Problem', 'Transaction Costs', 'Property Rights', 'Coase Theorem', 'Behavioral Economics', 'Bounded Rationality', 'Prospect Theory'],
    'Macroeconomics': ['GDP', 'Inflation', 'Unemployment', 'Economic Growth', 'Business Cycle', 'Monetary Policy', 'Fiscal Policy', 'Central Banking', 'Interest Rates', 'Exchange Rates', 'Balance of Payments', 'Trade Deficit', 'National Debt', 'Budget Deficit', 'Money Supply', 'Aggregate Demand', 'Aggregate Supply', 'Keynesian Economics', 'Monetarism', 'Supply-Side Economics', 'New Classical Economics', 'New Keynesian Economics', 'Real Business Cycle Theory', 'Endogenous Growth Theory', 'Phillips Curve'],
    'International Economics': ['International Trade', 'Comparative Advantage', 'Absolute Advantage', 'Trade Policy', 'Tariffs', 'Quotas', 'Free Trade', 'Protectionism', 'Trade Agreements', 'WTO', 'NAFTA', 'European Union', 'ASEAN', 'Mercosur', 'Foreign Direct Investment', 'Multinational Corporations', 'Globalization', 'Currency Exchange', 'Exchange Rate Regimes', 'Balance of Payments', 'Current Account', 'Capital Account', 'IMF', 'World Bank', 'Bretton Woods System'],
    'Financial Economics': ['Stock Market', 'Bond Market', 'Derivatives', 'Options', 'Futures', 'Portfolio Theory', 'Capital Asset Pricing Model', 'Efficient Market Hypothesis', 'Behavioral Finance', 'Corporate Finance', 'Investment Banking', 'Commercial Banking', 'Insurance', 'Pension Funds', 'Mutual Funds', 'Hedge Funds', 'Private Equity', 'Venture Capital', 'Initial Public Offering', 'Mergers and Acquisitions', 'Leveraged Buyout', 'Credit Rating', 'Risk Management', 'Financial Regulation', 'Basel Accords'],
    'Development Economics': ['Economic Development', 'Poverty', 'Inequality', 'Human Development Index', 'Millennium Development Goals', 'Sustainable Development Goals', 'Foreign Aid', 'Microfinance', 'Conditional Cash Transfers', 'Education Economics', 'Health Economics', 'Agricultural Development', 'Industrialization', 'Urbanization', 'Demographic Transition', 'Institutional Economics', 'Corruption', 'Property Rights', 'Rule of Law', 'Good Governance', 'Structural Adjustment', 'Washington Consensus', 'Beijing Consensus', 'Bottom of the Pyramid', 'Social Entrepreneurship']
  },
  'Sports': {
    'Team Sports': ['Football', 'Basketball', 'Baseball', 'Soccer', 'Cricket', 'Rugby', 'Hockey', 'Volleyball', 'Handball', 'Water Polo', 'Lacrosse', 'American Football', 'Australian Rules Football', 'Netball', 'Softball', 'Field Hockey', 'Ice Hockey', 'Ultimate Frisbee', 'Polo', 'Kabaddi', 'Sepak Takraw', 'Hurling', 'Gaelic Football', 'Bandy', 'Floorball'],
    'Individual Sports': ['Tennis', 'Golf', 'Boxing', 'Swimming', 'Athletics', 'Gymnastics', 'Cycling', 'Skiing', 'Snowboarding', 'Surfing', 'Skateboarding', 'Rock Climbing', 'Archery', 'Fencing', 'Judo', 'Karate', 'Taekwondo', 'Wrestling', 'Weightlifting', 'Diving', 'Figure Skating', 'Speed Skating', 'Equestrian', 'Rowing', 'Canoeing'],
    'Motor Sports': ['Formula One', 'NASCAR', 'Rally Racing', 'MotoGP', 'IndyCar', 'Drag Racing', 'Karting', 'Endurance Racing', 'Touring Car Racing', 'Off-Road Racing', 'Rallycross', 'Formula E', 'WRC', 'DTM', 'Le Mans', 'Dakar Rally', 'Isle of Man TT', 'Superbike Racing', 'Monster Truck', 'Sprint Car Racing', 'Stock Car Racing', 'Hill Climb', 'Autocross', 'Drifting', 'Time Attack'],
    'Olympic Sports': ['Olympic Games', 'Summer Olympics', 'Winter Olympics', 'Paralympic Games', 'Youth Olympics', 'Olympic Medals', 'Olympic Records', 'Olympic History', 'Olympic Venues', 'Olympic Torch', 'Olympic Opening Ceremony', 'Olympic Closing Ceremony', 'Olympic Athletes', 'Olympic Countries', 'Olympic Sports', 'Track and Field', 'Swimming', 'Gymnastics', 'Diving', 'Rowing', 'Canoeing', 'Sailing', 'Shooting', 'Archery', 'Triathlon'],
    'Extreme Sports': ['Base Jumping', 'Skydiving', 'Bungee Jumping', 'Parkour', 'Free Running', 'Mountain Biking', 'BMX', 'Motocross', 'Supercross', 'Freestyle Skiing', 'Snowmobiling', 'White Water Rafting', 'Kayaking', 'Kite Surfing', 'Windsurfing', 'Paragliding', 'Hang Gliding', 'Cave Diving', 'Ice Climbing', 'Free Diving', 'Big Wave Surfing', 'Wingsuit Flying', 'Slacklining', 'Street Luge', 'Downhill Skating']
  },
  'Literature & Languages': {
    'World Literature': ['English Literature', 'American Literature', 'French Literature', 'German Literature', 'Russian Literature', 'Spanish Literature', 'Chinese Literature', 'Japanese Literature', 'Indian Literature', 'African Literature', 'Latin American Literature', 'Middle Eastern Literature', 'Italian Literature', 'Scandinavian Literature', 'Eastern European Literature', 'Classical Literature', 'Medieval Literature', 'Renaissance Literature', 'Romantic Literature', 'Victorian Literature', 'Modernist Literature', 'Postmodern Literature', 'Contemporary Literature', 'World Poetry', 'Epic Poetry'],
    'Languages': ['English Language', 'Spanish Language', 'Mandarin Chinese', 'Hindi', 'Arabic', 'Bengali', 'Portuguese', 'Russian', 'Japanese', 'German', 'French', 'Korean', 'Turkish', 'Vietnamese', 'Italian', 'Polish', 'Ukrainian', 'Persian', 'Swahili', 'Tamil', 'Linguistics', 'Phonetics', 'Syntax', 'Semantics', 'Morphology'],
    'Writing Systems': ['Latin Alphabet', 'Cyrillic Alphabet', 'Arabic Script', 'Chinese Characters', 'Hiragana', 'Katakana', 'Hangul', 'Devanagari', 'Greek Alphabet', 'Hebrew Alphabet', 'Thai Script', 'Armenian Alphabet', 'Georgian Script', 'Ethiopic Script', 'Tamil Script', 'Bengali Script', 'Cuneiform', 'Hieroglyphics', 'Runes', 'Braille', 'Morse Code', 'Sign Language', 'International Phonetic Alphabet', 'Shorthand', 'Stenography']
  }
};

// Generate Wikipedia-style content
function generateWikiContent(topic, subject, category) {
  const relatedTopics = getRelatedTopics(topic, subject, category);
  const seeAlso = relatedTopics.map(t => `- [[${t}]]`).join('\n');

  return `# ${topic}

> *From Wikipedia, the free encyclopedia*

**${topic}** is a fundamental concept in [[${category}]], specifically within the field of [[${subject}]].

## Overview

${topic} represents an important area of study that has significant implications for our understanding of ${subject.toLowerCase()}. The development of this field has been influenced by various historical, theoretical, and practical considerations.

## Historical Development

The study of ${topic} has evolved significantly over time. Early investigations into this area began in the late 19th and early 20th centuries, when researchers first started to systematically explore the underlying principles.

## Key Concepts

### Theoretical Foundation

The theoretical framework surrounding ${topic} is built upon several core principles:

- **Primary Principle**: The fundamental basis of ${topic}
- **Secondary Aspects**: Supporting theories and concepts
- **Applied Considerations**: Practical implementations and real-world applications

### Modern Understanding

Contemporary research in ${topic} has expanded our knowledge significantly. Recent developments include:

1. Advanced theoretical models
2. Empirical validation through experimentation
3. Integration with related fields
4. Technological applications and innovations

## Relationship to ${subject}

${topic} plays a crucial role within the broader context of [[${subject}]]. Understanding this relationship helps contextualize its importance in the field.

## Contemporary Research

Current research in ${topic} focuses on several key areas:

- **Theoretical Advancement**: Developing new models and frameworks
- **Empirical Studies**: Conducting experiments and gathering data
- **Applied Research**: Creating practical applications and solutions
- **Interdisciplinary Connections**: Linking with other fields

## Applications

The principles of ${topic} find applications in various domains:

1. **Academic Research**: Fundamental investigations
2. **Industrial Applications**: Practical implementations
3. **Educational Context**: Teaching and learning
4. **Public Policy**: Informing decision-making

## Challenges and Controversies

Like many areas of study, ${topic} faces certain challenges:

- Theoretical debates and competing models
- Methodological limitations
- Practical implementation difficulties
- Ethical considerations

## Future Directions

The future of ${topic} research appears promising, with several emerging trends:

- Integration of new technologies
- Cross-disciplinary collaboration
- Global research initiatives
- Sustainable and ethical approaches

${relatedTopics.length > 0 ? `## See Also\n\n${seeAlso}` : ''}

## References

1. Smith, J. (2020). *Foundations of ${topic}*. Academic Press.
2. Johnson, M. & Williams, R. (2019). "${topic} in the 21st Century". Journal of ${subject}, 45(3), 234-256.
3. Brown, A. et al. (2021). *Advanced Studies in ${topic}*. University Press.

## External Links

- [${topic} Research Institute](https://example.com)
- [International ${topic} Association](https://example.com)
- [${topic} Educational Resources](https://example.com)

---

*Categories: [[${category}]] | [[${subject}]] | ${topic}*

*Last updated: ${new Date().toLocaleDateString()}*
`;
}

// Get related topics for cross-linking (more conservative)
function getRelatedTopics(currentTopic, currentSubject, currentCategory) {
  const related = [];

  // Add 2-3 topics from same subject only
  if (SUBJECTS[currentCategory] && SUBJECTS[currentCategory][currentSubject]) {
    const subjectTopics = SUBJECTS[currentCategory][currentSubject]
      .filter(t => t !== currentTopic);
    // Only take 2-3 random topics from same subject
    const randomTopics = subjectTopics.sort(() => 0.5 - Math.random()).slice(0, 3);
    related.push(...randomTopics);
  }

  return related;
}

// Create kanban board
function createKanbanBoard(category, topics) {
  const columns = {
    'to-learn': {
      name: 'To Learn',
      order: 0,
      cards: []
    },
    'learning': {
      name: 'Currently Learning',
      order: 1,
      cards: []
    },
    'mastered': {
      name: 'Mastered',
      order: 2,
      cards: []
    }
  };

  // Add some topics to different columns
  topics.slice(0, 5).forEach((topic, idx) => {
    const now = new Date().toISOString();
    columns['to-learn'].cards.push({
      id: `card-${idx}`,
      title: topic,
      description: `Study and master ${topic}`,
      tags: [category],
      assignee: null,
      priority: 'normal',
      due_date: null,
      linked_notes: [`${category}/${topic.replace(/\s+/g, '-')}.md`],
      checklist: [],
      created: now,
      modified: now
    });
  });

  return {
    version: '1.0.0',
    name: `${category} Learning`,
    columns,
    settings: {
      card_template: {},
      automations: [],
      custom_fields: []
    },
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      created_with: 'Lokus'
    }
  };
}

// Main generation function
async function generateDemoWorkspace() {
  console.log('🚀 Generating Lokus Demo Workspace...\n');

  // Create base directory
  if (!fs.existsSync(DEMO_PATH)) {
    fs.mkdirSync(DEMO_PATH, { recursive: true });
  }

  let totalFiles = 0;
  const allTopics = [];

  // Create subject folders and pages
  for (const [category, subjects] of Object.entries(SUBJECTS)) {
    console.log(`📁 Creating ${category}...`);
    const categoryPath = path.join(DEMO_PATH, category);
    fs.mkdirSync(categoryPath, { recursive: true });

    for (const [subject, topics] of Object.entries(subjects)) {
      const subjectPath = path.join(categoryPath, subject);
      fs.mkdirSync(subjectPath, { recursive: true });

      // Generate markdown files for each topic
      for (const topic of topics) {
        // Sanitize filename to remove invalid characters
        const fileName = `${topic.replace(/\s+/g, '-').replace(/\//g, '-')}.md`;
        const filePath = path.join(subjectPath, fileName);
        const content = generateWikiContent(topic, subject, category);

        fs.writeFileSync(filePath, content, 'utf8');
        totalFiles++;
        allTopics.push({ category, subject, topic });
      }

      console.log(`  ✓ ${subject}: ${topics.length} pages`);
    }

    // Create kanban board for category
    const categoryTopics = Object.values(subjects).flat();
    const kanban = createKanbanBoard(category, categoryTopics);
    const kanbanPath = path.join(categoryPath, `${category}-Learning.kanban`);
    fs.writeFileSync(kanbanPath, JSON.stringify(kanban, null, 2), 'utf8');
    console.log(`  ✓ Created kanban board: ${category}-Learning.kanban`);
  }

  // Create index page
  console.log('\n📝 Creating index page...');
  const indexContent = `# Lokus Demo - Knowledge Base

Welcome to the Lokus Demo Knowledge Base! This workspace contains over ${totalFiles} Wikipedia-style pages organized by subject.

## Categories

${Object.keys(SUBJECTS).map(cat => `### [[${cat}]]\n\n${Object.keys(SUBJECTS[cat]).map(subj => `- [[${subj}]] (${SUBJECTS[cat][subj].length} topics)`).join('\n')}`).join('\n\n')}

## Quick Start

1. Browse by category using the sidebar
2. Use wiki links [[like this]] to navigate between topics
3. Check out the kanban boards for organized learning paths
4. Use the graph view to explore connections

## Features Demonstrated

- ✅ 1000+ interconnected wiki pages
- ✅ Proper [[wiki link]] syntax throughout
- ✅ Organized folder structure by subject
- ✅ Kanban boards for learning tracking
- ✅ Rich markdown content
- ✅ Cross-referenced topics

## Statistics

- **Total Pages**: ${totalFiles}
- **Categories**: ${Object.keys(SUBJECTS).length}
- **Subjects**: ${Object.values(SUBJECTS).reduce((sum, cat) => sum + Object.keys(cat).length, 0)}
- **Kanban Boards**: ${Object.keys(SUBJECTS).length}

---

*Generated with Lokus Demo Generator*
*Last updated: ${new Date().toLocaleDateString()}*
`;

  fs.writeFileSync(path.join(DEMO_PATH, 'README.md'), indexContent, 'utf8');

  // Create a master overview canvas
  console.log('🎨 Creating overview canvas...');
  const canvasContent = `# Knowledge Base Overview

This canvas provides a visual overview of the knowledge base structure.

## Main Categories

${Object.keys(SUBJECTS).map((cat, idx) => `
### ${idx + 1}. [[${cat}]]

${Object.keys(SUBJECTS[cat]).map(subj => `- [[${subj}]]`).join('\n')}
`).join('\n')}

## Learning Paths

Each category has an associated kanban board for tracking your learning progress:

${Object.keys(SUBJECTS).map(cat => `- **${cat}**: See \`${cat}/${cat}-Learning.kanban\``).join('\n')}

## Navigation Tips

1. Use **Ctrl/Cmd + P** to quickly search for any page
2. Click on [[wiki links]] to navigate
3. Use the **Graph View** to visualize connections
4. Check the **File Explorer** for the complete hierarchy

---

*This is a demo workspace showcasing Lokus features*
`;

  fs.writeFileSync(path.join(DEMO_PATH, 'Overview-Canvas.md'), canvasContent, 'utf8');

  console.log('\n✅ Demo workspace generation complete!');
  console.log(`\n📊 Statistics:`);
  console.log(`   Total markdown pages: ${totalFiles}`);
  console.log(`   Kanban boards: ${Object.keys(SUBJECTS).length}`);
  console.log(`   Canvas files: 1`);
  console.log(`\n📍 Location: ${DEMO_PATH}`);
  console.log('\n🎯 Open this workspace in Lokus to explore!');
}

// Run the generator
generateDemoWorkspace().catch(console.error);
