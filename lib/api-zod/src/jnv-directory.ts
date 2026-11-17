// State-wise school directory based on the cited Wikipedia list. Records are
// kept as individual schools where the source distinguishes I/II campuses.
// Source: https://en.wikipedia.org/wiki/List_of_Jawahar_Navodaya_Vidyalayas
// That page claims 661 schools, but its state tables do not reconcile to 661
// unique school names after removing repeated rows; unresolved names are not guessed.
export const JNV_DATA: Record<string, string[]> = {
  "Andhra Pradesh": [
    "JNV Anantapur", "JNV Chittoor", "JNV East Godavari-I", "JNV East Godavari-II", "JNV Guntur",
    "JNV Krishna", "JNV Kurnool", "JNV Nellore", "JNV Prakasam-I", "JNV Prakasam-II",
    "JNV Srikakulam", "JNV Visakhapatnam", "JNV Vizianagaram", "JNV West Godavari",
    "JNV Kadapa"
  ],
  "Arunachal Pradesh": [
    "JNV Changlang", "JNV Dibang Valley", "JNV East Kameng", "JNV East Siang",
    "JNV Kra Daadi", "JNV Kurung Kumey", "JNV Lohit", "JNV Longding",
    "JNV Lower Dibang Valley", "JNV Lower Subansiri", "JNV Namsai", "JNV Papum Pare",
    "JNV Tawang", "JNV Tirap", "JNV Upper Siang", "JNV Upper Subansiri",
    "JNV West Kameng", "JNV West Siang"
  ],
  "Assam": [
    "JNV Baksa", "JNV Barpeta", "JNV Biswanath", "JNV Bongaigaon", "JNV Cachar", "JNV Chirang",
    "JNV Darrang", "JNV Dhemaji", "JNV Dhubri", "JNV Dibrugarh",
    "JNV Dima Hasao", "JNV Goalpara", "JNV Golaghat", "JNV Hailakandi",
    "JNV Jorhat", "JNV Kamrup", "JNV Karbi Anglong", "JNV Karimganj",
    "JNV Kokrajhar", "JNV Lakhimpur", "JNV Morigaon", "JNV Nagaon",
    "JNV Nalbari", "JNV Sivasagar", "JNV Sonitpur", "JNV Tinsukia", "JNV Udalguri",
    "JNV West Karbi Anglong"
  ],
  "Bihar": [
    "JNV Araria", "JNV Arwal", "JNV Aurangabad", "JNV Banka",
    "JNV Begusarai", "JNV Bhagalpur", "JNV Bhojpur", "JNV Buxar",
    "JNV Darbhanga", "JNV East Champaran", "JNV Gaya-I", "JNV Gaya-II", "JNV Gopalganj",
    "JNV Jamui", "JNV Jehanabad", "JNV Kaimur", "JNV Katihar",
    "JNV Khagaria", "JNV Kishanganj", "JNV Lakhisarai", "JNV Madhepura",
    "JNV Madhubani", "JNV Munger", "JNV Muzaffarpur", "JNV Nalanda",
    "JNV Nawada", "JNV Patna", "JNV Purnia", "JNV Rohtas",
    "JNV Saharsa", "JNV Samastipur", "JNV Saran", "JNV Sheikhpura",
    "JNV Sheohar", "JNV Sitamarhi", "JNV Siwan", "JNV Supaul",
    "JNV Vaishali", "JNV West Champaran"
  ],
  "Chhattisgarh": [
    "JNV Bastar", "JNV Bijapur", "JNV Bilaspur", "JNV Balod", "JNV Balodabazar",
    "JNV Balrampur", "JNV Bemetara", "JNV Dantewada", "JNV Dhamtari", "JNV Durg",
    "JNV Gariaband", "JNV Janjgir Champa", "JNV Jashpur", "JNV Kabirdham",
    "JNV Kanker", "JNV Kondagaon", "JNV Korba", "JNV Korea", "JNV Mahasamund",
    "JNV Mungeli", "JNV Narayanpur", "JNV Raigarh", "JNV Raipur", "JNV Rajnandgaon",
    "JNV Sukma-I", "JNV Sukma-II", "JNV Surajpur", "JNV Surguja"
  ],
  "Delhi": ["JNV North-West Delhi", "JNV South-West Delhi"],
  "Goa": [
    "JNV North Goa", "JNV South Goa"
  ],
  "Gujarat": [
    "JNV Ahmedabad", "JNV Amreli", "JNV Anand", "JNV Banaskantha",
    "JNV Bharuch", "JNV Bhavnagar", "JNV Botad", "JNV Chhota Udaipur",
    "JNV Dahod-I", "JNV Dahod-II", "JNV Dang", "JNV Devbhoomi Dwarka", "JNV Gandhinagar",
    "JNV Gir Somnath", "JNV Jamnagar", "JNV Junagadh", "JNV Kheda", "JNV Aravalli",
    "JNV Kutch", "JNV Mahisagar", "JNV Mehsana", "JNV Morbi",
    "JNV Narmada", "JNV Navsari", "JNV Panchmahal", "JNV Patan",
    "JNV Porbandar", "JNV Rajkot", "JNV Sabarkantha", "JNV Surat",
    "JNV Surendranagar", "JNV Tapi", "JNV Vadodara", "JNV Valsad"
  ],
  "Haryana": [
    "JNV Ambala", "JNV Bhiwani", "JNV Faridabad",
    "JNV Fatehabad", "JNV Gurugram", "JNV Hisar", "JNV Jhajjar",
    "JNV Jind", "JNV Kaithal", "JNV Karnal", "JNV Kurukshetra",
    "JNV Mahendragarh", "JNV Nuh", "JNV Palwal", "JNV Panchkula",
    "JNV Panipat", "JNV Rewari", "JNV Rohtak", "JNV Sirsa",
    "JNV Sonipat", "JNV Yamunanagar"
  ],
  "Himachal Pradesh": [
    "JNV Bilaspur", "JNV Chamba", "JNV Hamirpur", "JNV Kangra",
    "JNV Kinnaur", "JNV Kullu", "JNV Lahaul Spiti", "JNV Mandi",
    "JNV Shimla", "JNV Sirmaur", "JNV Solan", "JNV Una"
  ],
  "Jharkhand": [
    "JNV Bokaro", "JNV Chatra", "JNV Deoghar", "JNV Dhanbad",
    "JNV Dumka", "JNV East Singhbhum", "JNV Garhwa", "JNV Giridih",
    "JNV Godda", "JNV Gumla", "JNV Hazaribagh", "JNV Jamtara",
    "JNV Khunti", "JNV Koderma", "JNV Latehar", "JNV Lohardaga",
    "JNV Pakur-I", "JNV Pakur-II", "JNV Palamu-I", "JNV Palamu-II", "JNV Ramgarh", "JNV Ranchi",
    "JNV Sahibganj", "JNV Seraikela Kharsawan", "JNV Simdega", "JNV West Singhbhum"
  ],
  "Karnataka": [
    "JNV Bagalkot", "JNV Ballari", "JNV Belagavi", "JNV Bengaluru Rural",
    "JNV Bengaluru Urban", "JNV Bidar", "JNV Chamarajanagara", "JNV Chikkaballapura",
    "JNV Chikkamagaluru", "JNV Chitradurga", "JNV Dakshina Kannada", "JNV Davanagere",
    "JNV Dharwad", "JNV Gadag", "JNV Hassan", "JNV Haveri",
    "JNV Kalaburagi-I", "JNV Kalaburagi-II", "JNV Kodagu", "JNV Kolar", "JNV Koppal",
    "JNV Mandya", "JNV Mysuru", "JNV Raichur", "JNV Ramanagara",
    "JNV Shivamogga", "JNV Tumakuru", "JNV Udupi", "JNV Uttara Kannada",
    "JNV Vijayapura", "JNV Yadgir"
  ],
  "Kerala": [
    "JNV Alappuzha", "JNV Ernakulam", "JNV Idukki", "JNV Kannur",
    "JNV Kasaragod", "JNV Kollam", "JNV Kottayam", "JNV Kozhikode",
    "JNV Malappuram", "JNV Palakkad", "JNV Pathanamthitta", "JNV Thiruvananthapuram",
    "JNV Thrissur", "JNV Wayanad"
  ],
  "Madhya Pradesh": [
    "JNV Agar Malwa", "JNV Alirajpur", "JNV Anuppur", "JNV Ashoknagar",
    "JNV Balaghat", "JNV Barwani", "JNV Betul", "JNV Bhind",
    "JNV Bhopal", "JNV Burhanpur", "JNV Chhatarpur", "JNV Chhindwara",
    "JNV Damoh", "JNV Datia", "JNV Dewas", "JNV Dhar",
    "JNV Dindori", "JNV Guna", "JNV Gwalior", "JNV Harda",
    "JNV Hoshangabad", "JNV Indore", "JNV Jabalpur", "JNV Jhabua-I", "JNV Jhabua-II",
    "JNV Katni", "JNV Khandwa", "JNV Khargone", "JNV Mandla",
    "JNV Mandsaur", "JNV Morena", "JNV Narsinghpur", "JNV Neemuch",
    "JNV Panna", "JNV Raisen", "JNV Rajgarh",
    "JNV Ratlam-I", "JNV Ratlam-II", "JNV Rewa", "JNV Sagar", "JNV Satna",
    "JNV Sehore", "JNV Seoni", "JNV Shahdol", "JNV Shajapur",
    "JNV Sheopur", "JNV Shivpuri", "JNV Sidhi", "JNV Singrauli",
    "JNV Tikamgarh", "JNV Ujjain-I", "JNV Ujjain-II", "JNV Umaria", "JNV Vidisha"
  ],
  "Maharashtra": [
    "JNV Ahmednagar", "JNV Akola", "JNV Amravati", "JNV Aurangabad",
    "JNV Beed", "JNV Bhandara", "JNV Buldhana", "JNV Chandrapur",
    "JNV Dhule", "JNV Gadchiroli", "JNV Gondia", "JNV Hingoli",
    "JNV Jalgaon", "JNV Jalna", "JNV Kolhapur", "JNV Latur",
    "JNV Nagpur", "JNV Nanded", "JNV Nandurbar-I", "JNV Nandurbar-II",
    "JNV Nashik", "JNV Osmanabad", "JNV Palghar", "JNV Parbhani",
    "JNV Pune", "JNV Raigad", "JNV Ratnagiri", "JNV Sangli",
    "JNV Satara", "JNV Sindhudurg", "JNV Solapur",
    "JNV Wardha", "JNV Washim", "JNV Yavatmal"
  ],
  "Manipur": [
    "JNV Senapati-I", "JNV Ukhrul", "JNV Bishnupur", "JNV Churachandpur",
    "JNV Imphal East", "JNV Kangpokpi", "JNV Imphal West", "JNV Tamenglong",
    "JNV Thoubal", "JNV Chandel"
  ],
  "Meghalaya": [
    "JNV East Garo Hills", "JNV East Jaintia Hills", "JNV East Khasi Hills-I", "JNV East Khasi Hills-II",
    "JNV North Garo Hills", "JNV Ri Bhoi", "JNV South Garo Hills",
    "JNV South West Garo Hills", "JNV South West Khasi Hills",
    "JNV West Garo Hills", "JNV West Jaintia Hills", "JNV West Khasi Hills"
  ],
  "Mizoram": [
    "JNV Aizawl", "JNV Champhai", "JNV Kolasib", "JNV Lawngtlai",
    "JNV Lunglei", "JNV Mamit", "JNV Saiha", "JNV Serchhip"
  ],
  "Nagaland": [
    "JNV Dimapur", "JNV Kiphire", "JNV Kohima", "JNV Longleng",
    "JNV Mokokchung", "JNV Mon", "JNV Peren", "JNV Phek",
    "JNV Tuensang", "JNV Wokha", "JNV Zunheboto"
  ],
  "Odisha": [
    "JNV Angul", "JNV Balangir", "JNV Balasore", "JNV Bargarh",
    "JNV Bhadrak", "JNV Boudh", "JNV Cuttack", "JNV Debagarh",
    "JNV Dhenkanal", "JNV Gajapati", "JNV Ganjam", "JNV Jagatsinghpur",
    "JNV Jajpur", "JNV Jharsuguda", "JNV Kalahandi", "JNV Kandhamal",
    "JNV Kendrapara", "JNV Kendujhar", "JNV Khordha", "JNV Koraput",
    "JNV Malkangiri-I", "JNV Malkangiri-II", "JNV Mayurbhanj", "JNV Nabarangpur", "JNV Nayagarh",
    "JNV Nuapada", "JNV Puri", "JNV Rayagada", "JNV Sambalpur",
    "JNV Subarnapur", "JNV Sundargarh"
  ],
  "Punjab": [
    "JNV Amritsar-I", "JNV Amritsar-II", "JNV Barnala", "JNV Bathinda", "JNV Faridkot",
    "JNV Fatehgarh Sahib", "JNV Fazilka", "JNV Ferozepur", "JNV Gurdaspur",
    "JNV Hoshiarpur", "JNV Jallandhar", "JNV Kapurthala", "JNV Ludhiana",
    "JNV Mansa", "JNV Moga", "JNV Muktsar", "JNV Nawanshahr",
    "JNV Pathankot", "JNV Patiala", "JNV Rupnagar", "JNV SAS Nagar",
    "JNV Sangrur", "JNV Tarn Taran"
  ],
  "Rajasthan": [
    "JNV Ajmer", "JNV Alwar", "JNV Banswara-I", "JNV Banswara-II", "JNV Baran",
    "JNV Barmer", "JNV Bharatpur", "JNV Bhilwara", "JNV Bikaner",
    "JNV Bundi", "JNV Chittorgarh", "JNV Churu", "JNV Dausa",
    "JNV Dholpur", "JNV Dungarpur", "JNV Hanumangarh", "JNV Jaipur",
    "JNV Jaisalmer", "JNV Jalore", "JNV Jhalawar", "JNV Jhunjhunu",
    "JNV Jodhpur", "JNV Karauli", "JNV Kota", "JNV Nagaur",
    "JNV Pali", "JNV Pratapgarh", "JNV Rajsamand", "JNV Sawai Madhopur",
    "JNV Sikar", "JNV Sirohi", "JNV Sri Ganganagar-I", "JNV Sri Ganganagar-II", "JNV Tonk",
    "JNV Udaipur"
  ],
  "Sikkim": [
    "JNV East Sikkim", "JNV North Sikkim", "JNV South Sikkim", "JNV West Sikkim"
  ],
  // Tamil Nadu has not accepted the Navodaya scheme; no JNVs are listed there.
  "Tamil Nadu": [],
  "Telangana": [
    "JNV Adilabad", "JNV Karimnagar", "JNV Khammam", "JNV Mahabubnagar",
    "JNV Medak", "JNV Nalgonda", "JNV Nizamabad", "JNV Ranga Reddy", "JNV Warangal"
  ],
  "Tripura": [
    "JNV Dhalai", "JNV Gomati", "JNV Khowai", "JNV North Tripura",
    "JNV Sepahijala", "JNV South Tripura", "JNV Unakoti",
    "JNV West Tripura"
  ],
  "Uttar Pradesh": [
    "JNV Agra", "JNV Aligarh", "JNV Prayagraj", "JNV Ambedakar Nagar",
    "JNV Amethi", "JNV JP Nagar", "JNV Auraiya", "JNV Azamgarh",
    "JNV Baghpat", "JNV Bharaich", "JNV Ballia", "JNV Balrampur",
    "JNV Banda", "JNV Barabanki", "JNV Bareilly", "JNV Basti",
    "JNV Bhadohi", "JNV Bijnor", "JNV Budaun", "JNV Bulandshahr",
    "JNV Chandauli", "JNV Chitrakoot", "JNV Deoria", "JNV Etah",
    "JNV Etawah", "JNV Farrukhabad", "JNV Fatehpur", "JNV Firozabad",
    "JNV GB Nagar", "JNV Ghaziabad", "JNV Ghazipur", "JNV Gonda",
    "JNV Gorakhpur", "JNV Hamirpur", "JNV Hapur", "JNV Hardoi",
    "JNV Hathras", "JNV Jalaun", "JNV Jaunpur", "JNV Jhansi",
    "JNV Kannauj", "JNV Kanpur Dehat", "JNV Kanpur Nagar", "JNV Kasganj",
    "JNV Kaushambi", "JNV Lakhimpur Kheri", "JNV Kushinagar", "JNV Lalitpur",
    "JNV Lucknow", "JNV Maharajganj", "JNV Mahoba", "JNV Mainpuri",
    "JNV Mathura", "JNV Mau", "JNV Meerut", "JNV Mirzapur",
    "JNV Moradabad", "JNV Muzaffarnagar", "JNV Pilibhit", "JNV Pratapgarh",
    "JNV Raebareli", "JNV Rampur", "JNV Saharanpur", "JNV Sambhal",
    "JNV Santkabir Nagar", "JNV Shahjahanpur", "JNV Shamli", "JNV Shravasti",
    "JNV Siddharth Nagar", "JNV Sitapur-I", "JNV Sitapur-II", "JNV Sonbhadra", "JNV Sultanpur",
    "JNV Unnao", "JNV Varanasi", "JNV Faizabad"
  ],
  "Uttarakhand": [
    "JNV Almora", "JNV Bageshwar", "JNV Chamoli", "JNV Champawat",
    "JNV Dehradun", "JNV Haridwar", "JNV Nainital", "JNV Pauri Garhwal",
    "JNV Pithoragarh", "JNV Rudraprayag", "JNV Tehri Garhwal", "JNV Udham Singh Nagar",
    "JNV Uttarkashi"
  ],
  "West Bengal": [
    "JNV Cooch Behar", "JNV Alipurduar", "JNV Jalpaiguri", "JNV Darjeeling",
    "JNV Uttar Dinajpur", "JNV Dakshin Dinajpur", "JNV Murshidabad", "JNV Birbhum",
    "JNV Nadia", "JNV Burdwan", "JNV Purulia", "JNV Bankura", "JNV Howrah",
    "JNV Hooghly", "JNV East Medinipur", "JNV West Medinipur", "JNV North 24 Parganas",
    "JNV S.24 Parganas-I", "JNV S.24 Parganas-II"
  ],
  "Jammu & Kashmir": [
    "JNV Anantnag", "JNV Bandipora", "JNV Baramulla", "JNV Budgam",
    "JNV Doda", "JNV Ganderbal", "JNV Jammu-I", "JNV Jammu-II", "JNV Kathua",
    "JNV Kishtwar", "JNV Kulgam", "JNV Kupwara", "JNV Poonch",
    "JNV Pulwama", "JNV Rajouri", "JNV Ramban", "JNV Reasi",
    "JNV Samba", "JNV Shopian", "JNV Udhampur"
  ],
  "Ladakh": [
    "JNV Kargil", "JNV Leh"
  ],
  "Chandigarh": ["JNV Chandigarh"],
  "Andaman and Nicobar Islands": ["JNV South Andaman", "JNV North & Middle Andaman", "JNV Car Nicobar"],
  "Dadra and Nagar Haveli and Daman and Diu": ["JNV Silvassa", "JNV Daman", "JNV Diu"],
  // Retain legacy keys so existing profile values remain resolvable.
  "Dadra & Nagar Haveli": ["JNV Dadra & Nagar Haveli"],
  "Daman & Diu": ["JNV Daman", "JNV Diu"],
  "Lakshadweep": ["JNV Minicoy"],
  "Puducherry": ["JNV Karaikal", "JNV Mahe", "JNV Puducherry", "JNV Yanam"],
};

export const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

// Keep both current and legacy labels mapped to the same school directory.
JNV_DATA["Jammu and Kashmir"] = JNV_DATA["Jammu & Kashmir"];

export function getJnvSchools(state: string): string[] {
  const seen = new Set<string>();
  return (JNV_DATA[state] ?? []).filter((school) => {
    const key = school.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isValidJnvSelection(state: string, school: string): boolean {
  return STATES.includes(state) && getJnvSchools(state).includes(school);
}
