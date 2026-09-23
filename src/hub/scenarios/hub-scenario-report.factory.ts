import type { HubScenarioSimulationReport } from '../schemas/hub-scenario-run.schema';
import type { HubDynamicScenarioBundle } from './hub-dynamic-scenario.factory';

export function buildScenarioSimulationReport(
  scenario: HubDynamicScenarioBundle,
  eventCode: string,
  generatedAt: Date,
): HubScenarioSimulationReport {
  const sourceSystems = [
    ...new Set(scenario.observations.map((item) => item.sourceSystem)),
  ];
  const countries = [
    ...new Map(
      scenario.observations.map((item) => [
        item.countryCode,
        { countryCode: item.countryCode, countryName: item.countryName },
      ]),
    ).values(),
  ];
  const sectors = [
    ...new Set(scenario.observations.map((item) => item.sector)),
  ];

  return {
    reportId: `SIM-${scenario.scenarioCode}`,
    reportType: 'SIMULATION',
    title: `Rapport de simulation — ${scenario.title}`,
    executiveSummary:
      'Le scénario met en évidence une convergence temporelle et géographique entre une anomalie hydroclimatique, une mortalité animale inhabituelle et une hausse de syndromes fébriles humains dans le bassin transfrontalier du Logone. Le rapprochement produit un signal à vérifier ; il ne constitue pas une alerte sanitaire officielle.',
    objective:
      'Démontrer la capacité du Hub CEEAC à ingérer, normaliser et rapprocher des données multisectorielles souveraines sans dupliquer les systèmes nationaux.',
    countries,
    sectors,
    sourceSystems,
    observationCount: scenario.observations.length,
    signalCount: 1,
    eventCount: 1,
    confidenceScore: scenario.signal.confidenceScore,
    findings: [
      'CAPC-AC simule une anomalie de pluie de 64 % et 18 km² de zones inondées dans l’Extrême-Nord du Cameroun.',
      'ARIS 3 simule 87 animaux symptomatiques répartis dans 6 foyers proches des zones inondées.',
      'DHIS2 simule 43 cas suspects côté camerounais et 19 cas concordants côté tchadien.',
      'La proximité temporelle, géographique et sectorielle justifie l’ouverture d’une vérification experte transfrontalière.',
    ],
    recommendations: [
      'Contrôler la qualité, la complétude et la date des fiches sources auprès des points focaux nationaux.',
      'Organiser une vérification conjointe santé humaine–santé animale–environnement dans le bassin du Logone.',
      'Documenter la décision experte dans le Hub avant toute qualification en alerte ou diffusion institutionnelle.',
    ],
    limitations: [
      'Toutes les données de ce document sont fictives et réservées à la démonstration.',
      'Une corrélation intersectorielle ne démontre pas à elle seule une causalité sanitaire.',
      'Le signal doit être vérifié par un expert mandaté avant toute création d’alerte officielle.',
    ],
    observationIds: scenario.observations.map((item) => item.canonicalId),
    signalCode: scenario.signal.signalCode,
    eventCode,
    generatedAt,
    official: false,
    simulated: true,
  };
}
