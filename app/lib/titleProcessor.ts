const additionalKeywords = [
  "sotwe", "bokep dood", "twitter", "bokepsatset", "simontok", "terbaru", "video", 
  "bokep video", "simintok", "xpanas", "Full album", "baru", "montok", "memek", 
  "bokep", "asupan", "doodstream", "bokepsin", "bebasindo", "pekoblive", "terabox", 
  "streaming", "viral", "indo", "tiktok", "telegram", "Doodstream", "Doods", "Pro", 
  "Telegram", "Full", "Album", "Viral", "Videos", "Poophd", "Twitter", "Bochiel", 
  "Asupan", "Link", "Streaming", "Web", "Folder", "Cilbo", "Live", "Tele", "Terupdate", 
  "Terbaru", "Links", "Lokal", "Dodstream", "Bokep", "Pemersatu", "Video", "Update", 
  "Dood", "Doostream", "Website", "Downloader", "Indo", "Lulustream", "Sotwe", 
  "Doodsflix", "Yakwad", "Doodflix", "Tobrut", "Lagi Viral", "Stw", "Doodstreem", 
  "Sumenep", "Malam", "Jilbab", "Sesuai", "Gambar", "Colmek", "Binor", "Davis", "Smp", 
  "Vk", "Asupan viral", "Download", "New", "Movies", "Hijab", "Hijabers", "Rusia", 
  "tele", "Bangsa", "Pejuang", "Lendir", "Popstream", "Staklam", "viral dood", 
  "Cpasmieux", "Prank", "Ojol"
];

let cachedShuffledKeywords: string[] | null = null;
let lastShuffleTime = 0;
const SHUFFLE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

const titleCache = new Map<string, string>();
const existingTitles = new Set<string>(); // Untuk melacak judul yang sudah ada

function getShuffledKeywords(): string[] {
  const now = Date.now();

  if (cachedShuffledKeywords && now - lastShuffleTime < SHUFFLE_CACHE_DURATION) {
    return cachedShuffledKeywords;
  }

  const shuffledKeywords = [...additionalKeywords];
  for (let i = shuffledKeywords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledKeywords[i], shuffledKeywords[j]] = [shuffledKeywords[j], shuffledKeywords[i]];
  }

  cachedShuffledKeywords = shuffledKeywords;
  lastShuffleTime = now;

  return shuffledKeywords;
}

function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash) / 2147483647;
}

function cleanAndFormatTitle(title: string): string {
  // 1. Bersihkan judul dari karakter khusus
  let cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, ' ');
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  // 2. Hapus kata duplikat (case-insensitive) dan format
  const wordsInTitle = cleanTitle.split(' ');
  const uniqueWords: string[] = [];
  const usedWords = new Set<string>();

  for (const word of wordsInTitle) {
    if (!word) continue; // Skip empty words
    
    const lowerWord = word.toLowerCase();
    if (!usedWords.has(lowerWord)) {
      const formattedWord = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      uniqueWords.push(formattedWord);
      usedWords.add(lowerWord);
    }
  }

  cleanTitle = uniqueWords.join(' ');

  return cleanTitle;
}

export function processTitle(title: string, file_code?: string): string {
  if (file_code && titleCache.has(file_code)) {
    return titleCache.get(file_code)!;
  }

  // Bersihkan dan format judul asli
  const cleanedTitle = cleanAndFormatTitle(title);
  let words = cleanedTitle.split(/\s+/);

  // Batas panjang kata (6-9 kata)
  const minWords = 6;
  const maxWords = 9;
  const currentWordCount = words.length;

  const shuffledKeywords = getShuffledKeywords();
  const keywordsCopy = file_code ? [...shuffledKeywords] : shuffledKeywords;

  if (file_code) {
    // Shuffle keywords secara konsisten berdasarkan file_code
    for (let i = keywordsCopy.length - 1; i > 0; i--) {
      const randomValue = seededRandom(file_code + i.toString());
      const j = Math.floor(randomValue * (i + 1));
      [keywordsCopy[i], keywordsCopy[j]] = [keywordsCopy[j], keywordsCopy[i]];
    }
  }

  const usedWords = new Set(words.map(word => word.toLowerCase()));

  // 3. Jika judul terlalu pendek (<6 kata), tambahkan kata kunci
  if (currentWordCount < minWords) {
    const wordsToAdd = minWords - currentWordCount;
    let addedWords = 0;

    for (const keyword of keywordsCopy) {
      if (addedWords >= wordsToAdd) break;

      const lowerKeyword = keyword.toLowerCase();
      if (!usedWords.has(lowerKeyword)) {
        const formattedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase();
        words.push(formattedKeyword);
        usedWords.add(lowerKeyword);
        addedWords++;
      }
    }
  }
  // 4. Jika judul terlalu panjang (>9 kata), potong
  else if (currentWordCount > maxWords) {
    words = words.slice(0, maxWords);
  }

  // 5. Pastikan judul unik
  let finalTitle = words.join(' ');
  const originalTitle = finalTitle;
  let counter = 1;

  while (existingTitles.has(finalTitle.toLowerCase())) {
    finalTitle = `${originalTitle} ${counter}`;
    counter++;
  }

  existingTitles.add(finalTitle.toLowerCase());

  if (file_code) {
    titleCache.set(file_code, finalTitle);
  }

  return finalTitle;
}
