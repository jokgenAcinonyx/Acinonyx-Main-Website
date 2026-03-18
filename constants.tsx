import React from 'react';
// lucide-react icons removed

export interface TraitDefinition {
  key: string;
  icon: React.ReactNode;
  name: string;
  description: string;
  logic: string;
  color: string;
}

export const KIJO_TRAITS: TraitDefinition[] = [
  {
    key: 'macro_genius',
    icon: null,
    name: 'Macro Genius',
    description: 'Ahli strategi yang tahu kapan harus push atau objective.',
    logic: 'Cocok untuk KIJO yang jago strategi, bukan sekadar jago bunuh lawan.',
    color: 'text-blue-400'
  },
  {
    key: 'hard_carry',
    icon: null,
    name: 'Hard Carry',
    description: 'Mekanik sangat tinggi, sering menang dengan skor MVP.',
    logic: 'Sering menang dengan skor MVP dan benar-benar "menggendong" tim.',
    color: 'text-yellow-400'
  },
  {
    key: 'human_shield',
    icon: null,
    name: 'Human Shield',
    description: 'Badge khusus untuk user Tank/Roamer yang sangat loyal.',
    logic: 'Melindungi Jokies-nya agar tidak mati.',
    color: 'text-green-400'
  },
  {
    key: 'pma_king',
    icon: null,
    name: 'PMA King',
    description: 'Positive Mental Attitude. Ramah dan tidak pernah toxic.',
    logic: 'Tetap kalem meskipun sedang dalam kondisi kalah.',
    color: 'text-pink-400'
  },
  {
    key: 'flash_response',
    icon: null,
    name: 'Flash Response',
    description: 'Respon chat super cepat di bawah 3 menit.',
    logic: 'Rata-rata membalas chat pertama kali adalah di bawah 3 menit.',
    color: 'text-orange-primary'
  },
  {
    key: 'on_fire',
    icon: null,
    name: 'On Fire',
    description: 'Sangat aktif menyelesaikan banyak pesanan.',
    logic: 'Menyelesaikan pesanan dengan total durasi 25 jam dalam 7 hari.',
    color: 'text-red-500'
  },
  {
    key: 'iron_wall',
    icon: null,
    name: 'Iron Wall',
    description: 'Penyelesaian pesanan sempurna tanpa komplain.',
    logic: 'Menyelesaikan 50+ pesanan tanpa pernah mendapatkan komplain atau refund.',
    color: 'text-gray-400'
  },
  {
    key: 'secret_agent',
    icon: null,
    name: 'Secret Agent',
    description: 'Agen rahasia dengan rekam jejak 100+ pesanan bersih.',
    logic: 'Menyelesaikan 100+ pesanan tanpa pernah mendapatkan komplain atau refund.',
    color: 'text-indigo-400'
  },
  {
    key: 'night_owl',
    icon: null,
    name: 'Night Owl',
    description: 'Aktif di jam malam (22:00 - 04:00).',
    logic: '70% jam operasional ada di jam 22:00 – 04:00.',
    color: 'text-purple-400'
  },
  {
    key: 'early_bird',
    icon: null,
    name: 'Early Bird',
    description: 'Rajin aktif di pagi hari (06:00 - 11:00).',
    logic: 'Rajin aktif di jam 06:00 – 11:00 pagi.',
    color: 'text-amber-400'
  },
  {
    key: 'trustees',
    icon: null,
    name: 'Trustees',
    description: 'Memiliki tingkat Repeat Order yang sangat tinggi.',
    logic: 'Pelanggan balik lagi ke dia berkali-kali.',
    color: 'text-emerald-400'
  }
];

export const JOKIES_TRAITS: TraitDefinition[] = [
  {
    key: 'polite_customer',
    icon: null,
    name: 'Polite Customer',
    description: 'Diberikan kepada Jokies yang gaya bahasanya sopan dan menghargai KIJO. Badge ini sangat meningkatkan keinginan KIJO untuk mengambil orderannya.',
    logic: 'Diberikan oleh KIJO setelah sesi berakhir.',
    color: 'text-blue-400'
  },
  {
    key: 'great_communicator',
    icon: null,
    name: 'Great Communicator',
    description: 'Untuk Jokies yang memberikan instruksi dengan jelas (misal: "tolong pakai hero ini", "fokus push ya") sehingga tidak ada miskomunikasi.',
    logic: 'Diberikan oleh KIJO setelah sesi berakhir.',
    color: 'text-green-400'
  },
  {
    key: 'chill_player',
    icon: null,
    name: 'Chill Player',
    description: 'Badge untuk Jokies yang tidak mudah marah (non-toxic) meskipun tim sedang dalam kondisi tertekan atau kalah.',
    logic: 'Diberikan oleh KIJO setelah sesi berakhir.',
    color: 'text-purple-400'
  },
  {
    key: 'quick_learner',
    icon: null,
    name: 'Quick Learner',
    description: 'Cocok untuk Jokies yang mau mendengarkan saran KIJO dan langsung mempraktikkannya di dalam game.',
    logic: 'Diberikan oleh KIJO setelah sesi berakhir.',
    color: 'text-yellow-400'
  },
  {
    key: 'always_ontime',
    icon: null,
    name: 'Always On-Time',
    description: 'Diberikan jika Jokies selalu hadir dan masuk ke dalam game tepat saat jam mulai sesi yang dijanjikan.',
    logic: 'Diberikan oleh KIJO setelah sesi berakhir.',
    color: 'text-orange-primary'
  },
  {
    key: 'consider_it_done',
    icon: null,
    name: 'Consider it done',
    description: 'Diberikan kepada Jokies yang langsung menekan tombol "Selesai" dan memberikan rating segera setelah mabar berakhir (Sangat disukai KIJO karena uang cepat cair).',
    logic: 'Diberikan oleh KIJO setelah sesi berakhir.',
    color: 'text-emerald-400'
  },
  {
    key: 'loyal_supporter',
    icon: null,
    name: 'Loyal Supporter',
    description: 'Diberikan kepada Jokies yang sudah melakukan Repeat Order kepada KIJO yang sama berkali-kali.',
    logic: 'Diberikan oleh KIJO setelah sesi berakhir.',
    color: 'text-red-500'
  },
  {
    key: 'carry_able',
    icon: null,
    name: 'Carry-able',
    description: 'Badge "lucu" yang menunjukkan Jokies ini siap menuruti semua arahan KIJO demi kemenangan.',
    logic: 'Diberikan oleh KIJO setelah sesi berakhir.',
    color: 'text-indigo-400'
  }
];

export const RANKS = [
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Master',
  'Grandmaster',
  'Epic',
  'Legend',
  'Mythic',
  'Mythical Honor',
  'Mythical Glory',
  'Mythical Immortal'
];
