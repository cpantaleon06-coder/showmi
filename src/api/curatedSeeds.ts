import { CanonicalGenre } from '../lib/genres';
import { DeckAnchor, SimilarTrackSeed } from './types';

/**
 * Hand-picked anchor -> similar-track pairs, used two ways:
 *  1. As the onboarding "dame más como esta" seed options, so the very first
 *     thing a new user sees is a genuinely surprising niche result instead
 *     of whatever a live Last.fm call happens to return that day.
 *  2. As the fallback deck source in src/api/lastfm.ts while no Supabase
 *     project / Last.fm API key is wired up yet.
 *
 * One anchor per canonical genre bucket from the cosmetic-mapping table
 * (see the genre synonym table in the product spec), so no single genre —
 * regional mexicano included — reads as "the" default. Selection is always
 * random across the full set (see pickDefaultAnchor in src/hooks/useDeck.ts
 * and curatedFallback in src/api/lastfm.ts); never hardcode a pick from this
 * object elsewhere.
 *
 * PLACEHOLDER DATA: these "similar" lists are editorial best-guesses, not
 * pulled from a live Last.fm call (no API key yet). Re-validate every entry
 * against real track.getSimilar / artist.getSimilar output before the demo
 * — the whole pitch of Showmi is that this list is genuinely surprising and
 * accurate, so a stale guess here undercuts the product's core claim.
 *
 * 2026-08-31: ampliado de 8 a 22, luego de 22 a 30, y luego de 30 a 37 en una
 * tercera pasada el mismo día, junto con lib/genres.ts -- la segunda pasada
 * seguía pesando mucho hacia Latino/en español (feedback directo del
 * usuario); esa ronda sumó mercados/idiomas sin representante todavía:
 * mandopop/cantopop, Bollywood, pop árabe, pop turco, bossa nova/MPB
 * (portugués, no español), soca/calypso y pop nórdico.
 *
 * 2026-09-01: ampliado de 37 a 53 -- electrónica se desglosó en
 * house/techno/trance/dubstep-bass/drum&bass, más emo/shoegaze, drill,
 * tejano/boleros, ópera/flamenco/bluegrass y highlife/celtic/fado -- cada
 * uno con su propio anchor + 3 similares, mismo criterio editorial que el
 * resto.
 */
export const curatedSimilarSeeds: Record<string, SimilarTrackSeed[]> = {
  // corridos_tumbados_regional
  'natanael cano::amor tumbado': [
    { artist: 'Junior H', title: 'El Azul', matchScore: 0.91 },
    { artist: 'Fuerza Regida', title: 'TQM', matchScore: 0.87 },
    { artist: 'Ivan Cornejo', title: 'Está Dañado', matchScore: 0.82 },
  ],
  // banda_norteno
  'grupo firme::el amor de su vida': [
    { artist: 'Christian Nodal', title: 'Botella Tras Botella', matchScore: 0.88 },
    { artist: 'Eslabon Armado', title: 'Ella Baila Sola', matchScore: 0.85 },
    { artist: 'Los Dos Carnales', title: 'Isa', matchScore: 0.76 },
  ],
  // reggaeton
  'bad bunny::monaco': [
    { artist: 'Rauw Alejandro', title: 'Cosa Nuestra', matchScore: 0.84 },
    { artist: 'Feid', title: 'Luna', matchScore: 0.8 },
    { artist: 'Arcángel', title: 'La Systema', matchScore: 0.74 },
  ],
  // trap_latino
  'anuel aa::ella quiere beber': [
    { artist: 'Ozuna', title: 'Se Preparó', matchScore: 0.85 },
    { artist: 'Myke Towers', title: 'Bandido', matchScore: 0.8 },
    { artist: 'Farruko', title: 'Krippy Kush', matchScore: 0.76 },
  ],
  // salsa
  'marc anthony::vivir mi vida': [
    { artist: 'Gilberto Santa Rosa', title: 'Conteo Regresivo', matchScore: 0.83 },
    { artist: 'Victor Manuelle', title: 'Se Me Rompe El Alma', matchScore: 0.79 },
    { artist: 'Grupo Niche', title: 'Cali Pachanguero', matchScore: 0.75 },
  ],
  // bachata
  'romeo santos::propuesta indecente': [
    { artist: 'Aventura', title: 'Obsesión', matchScore: 0.87 },
    { artist: 'Prince Royce', title: 'Darte un Beso', matchScore: 0.82 },
    { artist: 'Xtreme', title: 'Shorty Shorty', matchScore: 0.74 },
  ],
  // cumbia
  'los ángeles azules::nunca es suficiente': [
    { artist: 'Selena', title: 'Bidi Bidi Bom Bom', matchScore: 0.81 },
    { artist: 'La Sonora Dinamita', title: 'Mi Cucu', matchScore: 0.77 },
    { artist: 'Fito Olivares', title: 'Juana la Cubana', matchScore: 0.73 },
  ],
  // vallenato
  'carlos vives::la gota fría': [
    { artist: 'Diomedes Díaz', title: 'Tú Eres La Reina', matchScore: 0.85 },
    { artist: 'Silvestre Dangond', title: 'Cásate Conmigo', matchScore: 0.79 },
    { artist: 'Peter Manjarrés', title: 'Amores Como el Nuestro', matchScore: 0.74 },
  ],
  // merengue
  'juan luis guerra::la bilirrubina': [
    { artist: 'Elvis Crespo', title: 'Suavemente', matchScore: 0.86 },
    { artist: 'Wilfrido Vargas', title: 'El Baile del Perrito', matchScore: 0.78 },
    { artist: 'Sergio Vargas', title: 'Ania', matchScore: 0.72 },
  ],
  // ranchera_mariachi
  'vicente fernández::volver volver': [
    { artist: 'Alejandro Fernández', title: 'Como Quien Pierde Una Estrella', matchScore: 0.87 },
    { artist: 'Pedro Infante', title: 'Amorcito Corazón', matchScore: 0.79 },
    { artist: 'Ana Gabriel', title: 'Ay Amor', matchScore: 0.75 },
  ],
  // tejano
  'selena::como la flor': [
    { artist: 'Emilio Navaira', title: 'Como Le Hago', matchScore: 0.8 },
    { artist: 'La Mafia', title: 'Un Millón de Rosas', matchScore: 0.76 },
    { artist: 'Intocable', title: 'Fuerte No Soy', matchScore: 0.73 },
  ],
  // boleros
  'luis miguel::la barca': [
    { artist: 'Los Panchos', title: 'Bésame Mucho', matchScore: 0.85 },
    { artist: 'Javier Solís', title: 'Payaso', matchScore: 0.79 },
    { artist: 'Armando Manzanero', title: 'Somos Novios', matchScore: 0.77 },
  ],
  // pop_latino
  'karol g::provenza': [
    { artist: 'Shakira', title: 'Te Felicito', matchScore: 0.85 },
    { artist: 'Sebastián Yatra', title: 'Traicionera', matchScore: 0.79 },
    { artist: 'TINI', title: 'Cupido', matchScore: 0.76 },
  ],
  // rock
  'queens of the stone age::no one knows': [
    { artist: 'Kyuss', title: 'Green Machine', matchScore: 0.87 },
    { artist: 'Them Crooked Vultures', title: 'New Fang', matchScore: 0.82 },
    { artist: 'Eagles of Death Metal', title: 'I Only Want You', matchScore: 0.75 },
  ],
  // metal
  'metallica::enter sandman': [
    { artist: 'Slipknot', title: 'Duality', matchScore: 0.84 },
    { artist: 'System of a Down', title: 'Toxicity', matchScore: 0.81 },
    { artist: 'Pantera', title: 'Walk', matchScore: 0.77 },
  ],
  // indie_lofi
  'mac demarco::chamber of reflection': [
    { artist: 'Homeshake', title: 'Every Song I Sing', matchScore: 0.86 },
    { artist: 'Men I Trust', title: 'Show Me How', matchScore: 0.83 },
    { artist: 'Cuco', title: 'Lo Que Siento', matchScore: 0.78 },
  ],
  // emo
  'my chemical romance::welcome to the black parade': [
    { artist: 'Paramore', title: 'Misery Business', matchScore: 0.85 },
    { artist: 'Dashboard Confessional', title: 'Vindicated', matchScore: 0.78 },
    { artist: 'Taking Back Sunday', title: 'MakeDamnSure', matchScore: 0.76 },
  ],
  // shoegaze_dreampop
  'beach house::space song': [
    { artist: 'My Bloody Valentine', title: 'Only Shallow', matchScore: 0.83 },
    { artist: 'Slowdive', title: 'Alison', matchScore: 0.8 },
    { artist: 'Cocteau Twins', title: 'Cherry-coloured Funk', matchScore: 0.76 },
  ],
  // pop
  'dua lipa::levitating': [
    { artist: 'The Weeknd', title: 'Blinding Lights', matchScore: 0.85 },
    { artist: 'Olivia Rodrigo', title: 'good 4 u', matchScore: 0.81 },
    { artist: 'Harry Styles', title: 'As It Was', matchScore: 0.8 },
  ],
  // hip_hop_rap
  'kendrick lamar::humble.': [
    { artist: 'J. Cole', title: 'No Role Modelz', matchScore: 0.84 },
    { artist: 'Travis Scott', title: 'SICKO MODE', matchScore: 0.82 },
    { artist: 'Drake', title: "God's Plan", matchScore: 0.79 },
  ],
  // drill
  'central cee::doja': [
    { artist: 'Pop Smoke', title: 'Dior', matchScore: 0.85 },
    { artist: 'Fivio Foreign', title: 'Big Drip', matchScore: 0.78 },
    { artist: 'Headie One', title: 'Both', matchScore: 0.75 },
  ],
  // rnb_soul
  'sza::kill bill': [
    { artist: 'Frank Ocean', title: 'Pink + White', matchScore: 0.83 },
    { artist: 'H.E.R.', title: 'Best Part', matchScore: 0.78 },
    { artist: 'Daniel Caesar', title: 'Get You', matchScore: 0.76 },
  ],
  // electronica
  'bonobo::kerala': [
    { artist: 'Tycho', title: 'Awake', matchScore: 0.85 },
    { artist: 'Rüfüs Du Sol', title: 'Innerbloom', matchScore: 0.81 },
    { artist: 'ODESZA', title: 'Say My Name', matchScore: 0.77 },
  ],
  // house
  'disclosure::latch': [
    { artist: 'Duke Dumont', title: 'Ocean Drive', matchScore: 0.83 },
    { artist: 'Route 94', title: 'My Love', matchScore: 0.78 },
    { artist: 'Gorgon City', title: 'Ready For Your Love', matchScore: 0.76 },
  ],
  // techno
  'charlotte de witte::doppler': [
    { artist: 'Amelie Lens', title: 'In My Mind', matchScore: 0.82 },
    { artist: 'Adam Beyer', title: 'Your Mind', matchScore: 0.77 },
    { artist: 'Carl Cox', title: 'I Want You (Forever)', matchScore: 0.75 },
  ],
  // trance
  'armin van buuren::this is what it feels like': [
    { artist: 'Above & Beyond', title: 'Sun & Moon', matchScore: 0.84 },
    { artist: 'Tiësto', title: 'Adagio for Strings', matchScore: 0.81 },
    { artist: 'Paul van Dyk', title: 'For An Angel', matchScore: 0.76 },
  ],
  // dubstep_bass
  'skrillex::bangarang': [
    { artist: 'Excision', title: 'X Rated', matchScore: 0.82 },
    { artist: 'Zeds Dead', title: 'Adrenaline', matchScore: 0.77 },
    { artist: 'Flux Pavilion', title: "I Can't Stop", matchScore: 0.79 },
  ],
  // drum_and_bass
  'netsky::never stop chasing': [
    { artist: 'Sub Focus', title: 'Rock It', matchScore: 0.81 },
    { artist: 'Andy C', title: 'Rollercoaster', matchScore: 0.77 },
    { artist: 'Wilkinson', title: 'Afterglow', matchScore: 0.78 },
  ],
  // jazz
  'kamasi washington::truth': [
    { artist: 'Robert Glasper', title: 'Butterfly (Mystic)', matchScore: 0.83 },
    { artist: 'BadBadNotGood', title: 'Time Moves Slow', matchScore: 0.79 },
    { artist: 'Yussef Dayes', title: 'OG Was Right', matchScore: 0.75 },
  ],
  // blues
  'b.b. king::the thrill is gone': [
    { artist: 'Muddy Waters', title: 'Hoochie Coochie Man', matchScore: 0.85 },
    { artist: 'Stevie Ray Vaughan', title: 'Pride and Joy', matchScore: 0.81 },
    { artist: 'John Lee Hooker', title: 'Boom Boom', matchScore: 0.77 },
  ],
  // k_pop
  'bts::dynamite': [
    { artist: 'BLACKPINK', title: 'Pink Venom', matchScore: 0.84 },
    { artist: 'NewJeans', title: 'Super Shy', matchScore: 0.8 },
    { artist: 'Stray Kids', title: 'S-Class', matchScore: 0.76 },
  ],
  // j_pop
  'yoasobi::idol': [
    { artist: 'Kenshi Yonezu', title: 'Lemon', matchScore: 0.85 },
    { artist: 'Perfume', title: 'Polyrhythm', matchScore: 0.78 },
    { artist: 'Ado', title: 'Usseewa', matchScore: 0.75 },
  ],
  // mandopop_cantopop
  'jay chou::qing hua ci': [
    { artist: 'Eason Chan', title: 'King of Me', matchScore: 0.81 },
    { artist: 'G.E.M.', title: 'Light Years Away', matchScore: 0.78 },
    { artist: 'Faye Wong', title: 'Red Bean', matchScore: 0.74 },
  ],
  // bollywood
  'arijit singh::tum hi ho': [
    { artist: 'A.R. Rahman', title: 'Jai Ho', matchScore: 0.85 },
    { artist: 'Neha Kakkar', title: 'Aankh Marey', matchScore: 0.79 },
    { artist: 'Shreya Ghoshal', title: 'Teri Ore', matchScore: 0.76 },
  ],
  // arabic_pop
  'amr diab::tamally maak': [
    { artist: 'Nancy Ajram', title: 'Ah W Noss', matchScore: 0.82 },
    { artist: 'Elissa', title: 'Ajmal Ehsas', matchScore: 0.77 },
    { artist: 'Saad Lamjarred', title: 'LM3ALLEM', matchScore: 0.75 },
  ],
  // turkish_pop
  'tarkan::şımarık': [
    { artist: 'Mabel Matiz', title: 'Aşkın Bahçesi', matchScore: 0.8 },
    { artist: 'Sezen Aksu', title: 'Kaçın Kurası', matchScore: 0.77 },
    { artist: 'Hadise', title: 'Düm Tek Tek', matchScore: 0.74 },
  ],
  // bossa_nova_mpb
  'joão gilberto::garota de ipanema': [
    { artist: 'Tom Jobim', title: 'Wave', matchScore: 0.85 },
    { artist: 'Marisa Monte', title: 'Ainda Bem', matchScore: 0.79 },
    { artist: 'Caetano Veloso', title: 'Sozinho', matchScore: 0.76 },
  ],
  // soca_calypso
  'machel montano::fast wine': [
    { artist: 'Bunji Garlin', title: 'Differentology', matchScore: 0.83 },
    { artist: 'Kes', title: 'Wotless', matchScore: 0.8 },
    { artist: 'Mighty Sparrow', title: 'Jean and Dinah', matchScore: 0.72 },
  ],
  // nordic_pop
  'tove lo::habits (stay high)': [
    { artist: 'Zara Larsson', title: 'Lush Life', matchScore: 0.82 },
    { artist: 'Icona Pop', title: 'I Love It', matchScore: 0.79 },
    { artist: 'Aurora', title: 'Runaway', matchScore: 0.76 },
  ],
  // country_folk
  'chris stapleton::tennessee whiskey': [
    { artist: 'Zach Bryan', title: 'Something in the Orange', matchScore: 0.82 },
    { artist: 'Kacey Musgraves', title: 'Slow Burn', matchScore: 0.77 },
    { artist: 'Noah Kahan', title: 'Stick Season', matchScore: 0.75 },
  ],
  // classical
  'ludovico einaudi::nuvole bianche': [
    { artist: 'Max Richter', title: 'On The Nature of Daylight', matchScore: 0.85 },
    { artist: 'Yiruma', title: 'River Flows in You', matchScore: 0.8 },
    { artist: 'Ólafur Arnalds', title: 'Near Light', matchScore: 0.78 },
  ],
  // opera
  'andrea bocelli::con te partirò': [
    { artist: 'Luciano Pavarotti', title: 'Nessun Dorma', matchScore: 0.87 },
    { artist: 'Maria Callas', title: 'Casta Diva', matchScore: 0.81 },
    { artist: 'Plácido Domingo', title: 'Granada', matchScore: 0.78 },
  ],
  // flamenco
  'paco de lucía::entre dos aguas': [
    { artist: 'Camarón de la Isla', title: 'Como el Agua', matchScore: 0.84 },
    { artist: 'Vicente Amigo', title: 'Tres Notas Para Decir Te Quiero', matchScore: 0.79 },
    { artist: 'Estrella Morente', title: 'Niña de Fuego', matchScore: 0.76 },
  ],
  // bluegrass
  'alison krauss::man of constant sorrow': [
    { artist: 'Bill Monroe', title: 'Blue Moon of Kentucky', matchScore: 0.83 },
    { artist: 'Earl Scruggs', title: 'Foggy Mountain Breakdown', matchScore: 0.79 },
    { artist: 'Billy Strings', title: 'Dust in a Baggie', matchScore: 0.77 },
  ],
  // ambient_new_age
  'brian eno::an ending (ascent)': [
    { artist: 'Stars of the Lid', title: 'Requiem for Dying Mothers', matchScore: 0.82 },
    { artist: 'Enya', title: 'Only Time', matchScore: 0.78 },
    { artist: 'Hammock', title: 'Kentucky', matchScore: 0.74 },
  ],
  // funk_disco
  'chic::le freak': [
    { artist: 'Earth, Wind & Fire', title: 'September', matchScore: 0.86 },
    { artist: 'Daft Punk', title: 'Get Lucky', matchScore: 0.83 },
    { artist: 'Bruno Mars', title: 'Uptown Funk', matchScore: 0.81 },
  ],
  // reggae
  'bob marley & the wailers::three little birds': [
    { artist: 'Peter Tosh', title: 'Legalize It', matchScore: 0.84 },
    { artist: 'Toots and the Maytals', title: 'Pressure Drop', matchScore: 0.79 },
    { artist: 'Sean Paul', title: 'Temperature', matchScore: 0.73 },
  ],
  // afrobeats
  'burna boy::last last': [
    { artist: 'Wizkid', title: 'Essence', matchScore: 0.86 },
    { artist: 'Davido', title: 'Fall', matchScore: 0.81 },
    { artist: 'Rema', title: 'Calm Down', matchScore: 0.8 },
  ],
  // highlife
  'osibisa::sunshine day': [
    { artist: 'E.T. Mensah', title: 'All For You', matchScore: 0.78 },
    { artist: 'Amakye Dede', title: 'Iron Boy', matchScore: 0.74 },
    { artist: 'Daddy Lumba', title: 'Aben Wo Ha', matchScore: 0.73 },
  ],
  // celtic_irish
  "the chieftains::the foggy dew": [
    { artist: 'Clannad', title: "Theme from Harry's Game", matchScore: 0.81 },
    { artist: 'The Dubliners', title: 'Whiskey in the Jar', matchScore: 0.8 },
    { artist: 'Altan', title: 'Green Grow the Rushes', matchScore: 0.74 },
  ],
  // fado
  'amália rodrigues::uma casa portuguesa': [
    { artist: 'Mariza', title: 'Barco Negro', matchScore: 0.85 },
    { artist: 'Carminho', title: 'Fado Sem Sorte', matchScore: 0.79 },
    { artist: 'Dulce Pontes', title: 'Canção do Mar', matchScore: 0.77 },
  ],
  // gospel_cristiana
  'kirk franklin::melodies from heaven': [
    { artist: 'Marco Barrientos', title: 'Puedo Ver', matchScore: 0.8 },
    { artist: 'Hillsong Worship', title: 'Oceans (Where Feet May Fail)', matchScore: 0.83 },
    { artist: 'Jesus Culture', title: 'Reckless Love', matchScore: 0.78 },
  ],
  // punk
  "the interrupters::she's kerosene": [
    { artist: 'Rancid', title: 'Ruby Soho', matchScore: 0.85 },
    { artist: 'Flogging Molly', title: 'Drunken Lullabies', matchScore: 0.8 },
    { artist: 'Streetlight Manifesto', title: 'A Better Place, A Better Time', matchScore: 0.76 },
  ],
};

/**
 * Mismos anchors de arriba, explícitamente etiquetados por género canónico
 * (no infiere del comentario/orden del objeto -- eso sería frágil) para que
 * el selector de sesión pueda anclar el deck a un género específico de
 * verdad, en vez de solo re-rankear un pool mixto.
 */
export const curatedAnchorsByGenre: Record<CanonicalGenre, DeckAnchor> = {
  corridos_tumbados_regional: { artist: 'Natanael Cano', title: 'Amor Tumbado' },
  banda_norteno: { artist: 'Grupo Firme', title: 'El Amor De Su Vida' },
  reggaeton: { artist: 'Bad Bunny', title: 'Monaco' },
  trap_latino: { artist: 'Anuel AA', title: 'Ella Quiere Beber' },
  salsa: { artist: 'Marc Anthony', title: 'Vivir Mi Vida' },
  bachata: { artist: 'Romeo Santos', title: 'Propuesta Indecente' },
  cumbia: { artist: 'Los Ángeles Azules', title: 'Nunca Es Suficiente' },
  vallenato: { artist: 'Carlos Vives', title: 'La Gota Fría' },
  merengue: { artist: 'Juan Luis Guerra', title: 'La Bilirrubina' },
  ranchera_mariachi: { artist: 'Vicente Fernández', title: 'Volver Volver' },
  tejano: { artist: 'Selena', title: 'Como La Flor' },
  boleros: { artist: 'Luis Miguel', title: 'La Barca' },
  pop_latino: { artist: 'Karol G', title: 'Provenza' },
  rock: { artist: 'Queens of the Stone Age', title: 'No One Knows' },
  metal: { artist: 'Metallica', title: 'Enter Sandman' },
  indie_lofi: { artist: 'Mac DeMarco', title: 'Chamber of Reflection' },
  emo: { artist: 'My Chemical Romance', title: 'Welcome to the Black Parade' },
  shoegaze_dreampop: { artist: 'Beach House', title: 'Space Song' },
  pop: { artist: 'Dua Lipa', title: 'Levitating' },
  hip_hop_rap: { artist: 'Kendrick Lamar', title: 'HUMBLE.' },
  drill: { artist: 'Central Cee', title: 'Doja' },
  rnb_soul: { artist: 'SZA', title: 'Kill Bill' },
  electronica: { artist: 'Bonobo', title: 'Kerala' },
  house: { artist: 'Disclosure', title: 'Latch' },
  techno: { artist: 'Charlotte de Witte', title: 'Doppler' },
  trance: { artist: 'Armin van Buuren', title: 'This Is What It Feels Like' },
  dubstep_bass: { artist: 'Skrillex', title: 'Bangarang' },
  drum_and_bass: { artist: 'Netsky', title: 'Never Stop Chasing' },
  jazz: { artist: 'Kamasi Washington', title: 'Truth' },
  blues: { artist: 'B.B. King', title: 'The Thrill Is Gone' },
  k_pop: { artist: 'BTS', title: 'Dynamite' },
  j_pop: { artist: 'YOASOBI', title: 'Idol' },
  mandopop_cantopop: { artist: 'Jay Chou', title: 'Qing Hua Ci' },
  bollywood: { artist: 'Arijit Singh', title: 'Tum Hi Ho' },
  arabic_pop: { artist: 'Amr Diab', title: 'Tamally Maak' },
  turkish_pop: { artist: 'Tarkan', title: 'Şımarık' },
  bossa_nova_mpb: { artist: 'João Gilberto', title: 'Garota de Ipanema' },
  soca_calypso: { artist: 'Machel Montano', title: 'Fast Wine' },
  nordic_pop: { artist: 'Tove Lo', title: 'Habits (Stay High)' },
  country_folk: { artist: 'Chris Stapleton', title: 'Tennessee Whiskey' },
  classical: { artist: 'Ludovico Einaudi', title: 'Nuvole Bianche' },
  opera: { artist: 'Andrea Bocelli', title: 'Con Te Partirò' },
  flamenco: { artist: 'Paco de Lucía', title: 'Entre Dos Aguas' },
  bluegrass: { artist: 'Alison Krauss', title: 'Man of Constant Sorrow' },
  ambient_new_age: { artist: 'Brian Eno', title: 'An Ending (Ascent)' },
  funk_disco: { artist: 'Chic', title: 'Le Freak' },
  reggae: { artist: 'Bob Marley & The Wailers', title: 'Three Little Birds' },
  afrobeats: { artist: 'Burna Boy', title: 'Last Last' },
  highlife: { artist: 'Osibisa', title: 'Sunshine Day' },
  celtic_irish: { artist: 'The Chieftains', title: 'The Foggy Dew' },
  fado: { artist: 'Amália Rodrigues', title: 'Uma Casa Portuguesa' },
  gospel_cristiana: { artist: 'Kirk Franklin', title: 'Melodies From Heaven' },
  punk: { artist: 'The Interrupters', title: "She's Kerosene" },
};

/**
 * Candidatos de "artistas de referencia" para el paso de tap del onboarding,
 * derivados de los mismos datos curados de arriba (ancla + similares) en vez
 * de una lista nueva aparte -- no hay catálogo de artistas real todavía.
 */
export function artistsForGenre(genre: CanonicalGenre): string[] {
  const anchor = curatedAnchorsByGenre[genre];
  const key = `${anchor.artist.toLowerCase()}::${anchor.title.toLowerCase()}`;
  const similar = curatedSimilarSeeds[key] ?? [];
  return [anchor.artist, ...similar.map((s) => s.artist)];
}
