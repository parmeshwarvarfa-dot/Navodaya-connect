import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform,
  RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
  useWindowDimensions, type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Business, type BusinessDetails, type BusinessReview } from "@/lib/api";
import { STATES } from "@/data/jnvData";
import { useAuth } from "@/context/AuthContext";
import ImageAdjustmentModal from "@/components/media/ImageAdjustmentModal";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type Category = { name: string; icon: IconName };
type FormData = {
  name: string; ownerName: string; category: string; description: string; services: string;
  address: string; state: string; district: string; pincode: string; phone: string; email: string;
  website: string; facebook: string; linkedin: string; instagram: string; xProfile: string;
  priceMin: string; priceMax: string; navodayansDiscount: string;
};

const CATEGORIES: Category[] = [
  { name: "Home services", icon: "home-outline" }, { name: "Education", icon: "school-outline" },
  { name: "IT", icon: "laptop-outline" }, { name: "Hospitality", icon: "bed-outline" },
  { name: "Construction", icon: "construct-outline" }, { name: "Retail", icon: "storefront-outline" },
  { name: "Healthcare", icon: "medkit-outline" }, { name: "Tourism", icon: "earth-outline" },
  { name: "Food", icon: "restaurant-outline" }, { name: "Media", icon: "images-outline" },
  { name: "Social work", icon: "heart-outline" }, { name: "Sports", icon: "football-outline" },
  { name: "Manufacturing", icon: "settings-outline" }, { name: "Agriculture", icon: "leaf-outline" },
  { name: "Business services", icon: "business-outline" }, { name: "Other", icon: "ellipsis-horizontal-circle-outline" },
];
const EMPTY_FORM: FormData = {
  name: "", ownerName: "", category: "", description: "", services: "", address: "", state: "", district: "", pincode: "",
  phone: "", email: "", website: "", facebook: "", linkedin: "", instagram: "", xProfile: "", priceMin: "", priceMax: "", navodayansDiscount: "0",
};
const PURPLE = "#7C3AED";
const PURPLE_DARK = "#18213B";
const PURPLE_PALE = "#F5F3FF";
export default function AlumniBusinessScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [photoToAdjust, setPhotoToAdjust] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [adjustmentVisible, setAdjustmentVisible] = useState(false);
  const [picker, setPicker] = useState<"category" | "state" | "district" | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [detail, setDetail] = useState<BusinessDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [toast, setToast] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const topRef = useRef<ScrollView | null>(null);

  const say = (message: string) => { setToast(message); setTimeout(() => setToast(""), 2800); };
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const rows = await api.businesses.list({ q: search, category, city });
      setBusinesses(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load businesses.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, category, city]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 260);
    return () => clearTimeout(timer);
  }, [load]);

  const featured = useMemo(() => [...businesses].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0)).slice(0, 10), [businesses]);
  const isAlumni = profile?.role === "alumni";

  const set = (key: keyof FormData, value: string) => {
    setFormError("");
    setForm((current) => ({ ...current, [key]: value }));
  };
  const startForm = () => {
    setForm({ ...EMPTY_FORM, ownerName: profile?.fullName ?? "" });
    setPhotos([]); setFormError(""); setStep(0); setFormVisible(true);
  };

  const pickPhoto = async () => {
    if (photos.length >= 10) return say("You can add up to 10 business photos.");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return say("Allow photo access to add business photos.");
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
      const asset = result.canceled ? null : result.assets?.[0] ?? null;
      if (!asset) return;
      setPhotoToAdjust(asset); setAdjustmentVisible(true);
    } catch { say("Could not open the photo picker. Please try again."); }
  };

  const validateStep = () => {
    if (step === 0 && (!form.name.trim() || !form.ownerName.trim())) return "Add the business name and owner name to continue.";
    if (step === 1 && (!form.category || !form.description.trim())) return "Choose a business category and add a short description.";
    if (step === 2 && !form.phone.trim() && !form.email.trim()) return "Add at least a phone number or email address.";
    if (step === 4) {
      if (!form.address.trim() || !form.state || !form.district.trim() || !/^\d{6}$/.test(form.pincode.trim())) return "Complete the address, state, district and 6-digit pincode.";
      if (form.priceMin && form.priceMax && Number(form.priceMax) < Number(form.priceMin)) return "Maximum price must be at least the minimum price.";
    }
    return "";
  };

  const publish = async () => {
    const validation = validateStep();
    if (validation) { setFormError(validation); return; }
    setFormError("");
    setSaving(true);
    const uploadedKeys: string[] = [];
    try {
      for (const photo of photos) {
        const result = await api.memories.uploadMedia(photo.uri, photo.fileName || "business-photo.jpg", photo.mimeType || "image/jpeg");
        uploadedKeys.push(result.key);
      }
      await api.businesses.create({
        name: form.name.trim(), ownerName: form.ownerName.trim(), category: form.category,
        description: form.description.trim(), services: form.services.trim(), city: form.district.trim(),
        address: form.address.trim(), state: form.state, district: form.district.trim(), pincode: form.pincode.trim(),
        phone: form.phone.trim(), email: form.email.trim(), website: form.website.trim(), facebook: form.facebook.trim(),
        linkedin: form.linkedin.trim(), instagram: form.instagram.trim(), xProfile: form.xProfile.trim(), mediaKeys: uploadedKeys,
        priceMin: form.priceMin.trim() ? Number(form.priceMin) : null,
        priceMax: form.priceMax.trim() ? Number(form.priceMax) : null,
        navodayansDiscount: Number(form.navodayansDiscount || 0), contactPreference: "message",
      });
      setFormVisible(false); setPhotos([]); setForm(EMPTY_FORM); setCategory(""); setSearch(""); setCity("");
      say("Your business is now in the alumni directory.");
      await load(true);
    } catch (err) {
      if (uploadedKeys.length) void api.memories.cleanupUploads(uploadedKeys).catch(() => undefined);
      setFormError(err instanceof Error ? err.message : "Could not publish this listing. Please try again.");
    } finally { setSaving(false); }
  };

  const openDetail = async (business: Business) => {
    setDetail(null); setExpandedDescription(false); setShowAllReviews(false); setGalleryIndex(0); setDetailLoading(true);
    try { setDetail(await api.businesses.get(business.id)); }
    catch (err) { say(err instanceof Error ? err.message : "Could not open this listing."); }
    finally { setDetailLoading(false); }
  };

  const submitReview = async () => {
    if (!detail) return;
    setSavingReview(true);
    try {
      await api.businesses.review(detail.id, reviewRating, reviewText.trim());
      setReviewVisible(false); setReviewText(""); setReviewRating(5);
      setDetail(await api.businesses.get(detail.id)); await load(true);
      say("Thanks for sharing your review.");
    } catch (err) { say(err instanceof Error ? err.message : "Could not save this review."); }
    finally { setSavingReview(false); }
  };

  const report = async () => {
    if (!detail) return;
    try { await api.communityReports.submit("business", detail.id, "Other"); say("Listing reported for review."); }
    catch (err) { say(err instanceof Error ? err.message : "Could not submit report."); }
  };

  const filteredPickerOptions = useMemo(() => {
    const query = pickerSearch.trim().toLocaleLowerCase();
    let options: string[] = picker === "state" ? STATES : picker === "category" ? CATEGORIES.map((item) => item.name) :
      [...new Set(businesses.filter((item) => item.state === form.state).map((item) => item.district).filter(Boolean))];
    if (query) options = options.filter((item) => item.toLocaleLowerCase().includes(query));
    return options;
  }, [picker, pickerSearch, businesses, form.state]);

  const choosePicker = (value: string) => {
    if (picker === "category") set("category", value);
    if (picker === "state") { set("state", value); set("district", ""); }
    if (picker === "district") set("district", value);
    setPicker(null); setPickerSearch("");
  };

  const bottomPadding = Math.max(insets.bottom, 16) + 80;

  return <View style={styles.screen}>
    <ScrollView
      ref={topRef}
      contentContainerStyle={{ paddingTop: Math.max(insets.top, 12) + 4, paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={PURPLE} />}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={21} color={PURPLE_DARK}/></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>NAVODAYA CONNECT</Text><Text style={styles.pageTitle}>Business network</Text></View>
        {isAlumni ? <TouchableOpacity style={styles.headerAdd} onPress={startForm} accessibilityLabel="List your business"><Ionicons name="add" size={19} color="#fff"/><Text style={styles.headerAddText}>List yours</Text></TouchableOpacity> : null}
      </View>
      <View style={styles.communityBanner}>
        <View style={styles.communityAccent} pointerEvents="none"/>
        <View style={styles.communityMark}><Ionicons name="people-outline" size={21} color={PURPLE}/></View>
        <View style={{ flex: 1 }}><Text style={styles.communityTitle}>Made for the Navodaya network</Text><Text style={styles.communityCopy}>Discover and support businesses shared by fellow alumni.</Text></View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={21} color={PURPLE}/>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search businesses" placeholderTextColor="#A8A0B5" style={styles.searchInput} returnKeyType="search" />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={18} color="#A8A0B5"/></TouchableOpacity> : null}
      </View>
      <View style={[styles.locationSearch, city ? styles.locationSearchActive : null]}>
        <Ionicons name="location-outline" size={18} color={PURPLE}/>
        <TextInput value={city} onChangeText={setCity} placeholder="City or district (optional)" placeholderTextColor="#A8A0B5" style={styles.locationInput}/>
        {city ? <TouchableOpacity onPress={() => setCity("")}><Ionicons name="close-circle" size={17} color="#A8A0B5"/></TouchableOpacity> : null}
      </View>

      <View style={styles.categoryBlock}>
        <View style={styles.categoryHeadingRow}><View><Text style={styles.categoryHeading}>Browse specialties</Text><Text style={styles.categorySubheading}>Explore by what you need</Text></View><Ionicons name="apps-outline" size={21} color={PURPLE}/></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
          <TouchableOpacity style={[styles.categoryChip, !category && styles.categoryChipActive]} onPress={() => setCategory("")} accessibilityRole="button" accessibilityState={{ selected: !category }}><Ionicons name="grid-outline" size={15} color={!category ? "#fff" : PURPLE}/><Text style={[styles.categoryChipText, !category && styles.categoryChipTextActive]}>All</Text></TouchableOpacity>
          {CATEGORIES.map((item) => {
            const selected = category === item.name;
            return <TouchableOpacity key={item.name} style={[styles.categoryChip, selected && styles.categoryChipActive]} onPress={() => setCategory(selected ? "" : item.name)} accessibilityRole="button" accessibilityState={{ selected }}><Ionicons name={item.icon} size={15} color={selected ? "#fff" : PURPLE}/><Text numberOfLines={1} style={[styles.categoryChipText, selected && styles.categoryChipTextActive]}>{item.name}</Text></TouchableOpacity>;
          })}
        </ScrollView>
      </View>

      <View style={styles.sectionTitleRow}>
        <View><Text style={styles.sectionTitle}>Community favourites</Text><Text style={styles.sectionCaption}>Alumni-owned brands and local services</Text></View>
        <TouchableOpacity onPress={() => topRef.current?.scrollToEnd({ animated: true })}><Text style={styles.viewAll}>View all</Text></TouchableOpacity>
      </View>
      {loading && !businesses.length ? <View style={styles.loadingBox}><ActivityIndicator color={PURPLE}/><Text style={styles.muted}>Finding businesses in your network…</Text></View> : error && !businesses.length ? <TouchableOpacity style={styles.empty} onPress={() => void load()}><Ionicons name="cloud-offline-outline" size={34} color="#8993A3"/><Text style={styles.emptyText}>{error}</Text><Text style={styles.viewAll}>Tap to retry</Text></TouchableOpacity> : featured.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredScroll}>
        {featured.map((item) => <BusinessCard key={item.id} item={item} width={Math.min(340, width - 58)} onPress={() => void openDetail(item)} featured />)}
      </ScrollView> : <View style={styles.emptyInline}><Ionicons name="business-outline" size={26} color="#A39BB1"/><Text style={styles.muted}>No listings yet. Add the first alumni business.</Text></View>}

      <View style={[styles.sectionTitleRow, { marginTop: 27 }]}>
        <View><Text style={styles.sectionTitle}>{category ? category : "Explore businesses"}</Text><Text style={styles.sectionCaption}>{businesses.length} {businesses.length === 1 ? "listing" : "listings"} in the directory</Text></View>
        {category || city || search ? <TouchableOpacity onPress={() => { setCategory(""); setCity(""); setSearch(""); }}><Text style={styles.viewAll}>Reset</Text></TouchableOpacity> : null}
      </View>
      {loading && businesses.length ? <ActivityIndicator style={{ padding: 25 }} color={PURPLE}/> : error && businesses.length ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.listings}>
        {businesses.length ? businesses.map((item) => <BusinessCard key={item.id} item={item} onPress={() => void openDetail(item)} />) : !loading ? <View style={styles.empty}><Ionicons name="search-outline" size={34} color="#A39BB1"/><Text style={styles.emptyTitle}>No matching businesses</Text><Text style={styles.muted}>Try another search or category.</Text></View> : null}
      </View>
      {!isAlumni ? <View style={styles.infoBanner}><Ionicons name="information-circle-outline" size={19} color={PURPLE}/><Text style={styles.infoText}>Only alumni accounts can publish a business listing.</Text></View> : null}
    </ScrollView>

    <Modal visible={formVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => !saving && setFormVisible(false)}>
      <KeyboardAvoidingView style={styles.formScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.formHeader, { paddingTop: Math.max(insets.top, 14) }]}>
          <TouchableOpacity style={styles.formBack} onPress={() => step > 0 ? setStep(step - 1) : setFormVisible(false)} disabled={saving}><Ionicons name="arrow-back" size={21} color={PURPLE_DARK}/></TouchableOpacity>
          <View style={{ flex: 1 }}><Text style={styles.formHeaderTitle}>Add your business</Text><Text style={styles.formHeaderSub}>Step {step + 1} of 5</Text></View>
          <TouchableOpacity onPress={() => !saving && setFormVisible(false)} style={styles.formClose}><Ionicons name="close" size={22} color="#685B79"/></TouchableOpacity>
        </View>
        <View style={styles.progressRow}>{Array.from({ length: 5 }, (_, index) => <View key={index} style={[styles.progressSegment, index <= step && styles.progressSegmentActive]}/>)}</View>
        <ScrollView contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.formHeroIcon}><Ionicons name="business" size={30} color={PURPLE}/></View>
          <Text style={styles.formTitle}>{["General information", "Business information", "Contact details", "Social media details", "Business location"][step]}</Text>
          <Text style={styles.formSubtitle}>{[
            "Your basic details help alumni recognize your business.",
            "Add photos and tell customers what you offer.",
            "Help customers reach you directly.",
            "Connect your business social profiles.",
            "Your location helps alumni find nearby services.",
          ][step]}</Text>

          {step === 0 ? <>
            <FormField label="Business name" value={form.name} onChangeText={(value) => set("name", value)} placeholder="Enter business name" icon="business-outline" autoCapitalize="words" />
            <FormField label="Owner name" value={form.ownerName} onChangeText={(value) => set("ownerName", value)} placeholder="Enter owner name" icon="person-outline" autoCapitalize="words" />
          </> : null}

          {step === 1 ? <>
            <Text style={styles.inputLabel}>Business photos</Text>
            <View style={styles.photoGrid}>
              {photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.photoThumbWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photoThumb}/>
                <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}><Ionicons name="close" size={15} color="#fff"/></TouchableOpacity>
              </View>)}
              {photos.length < 10 ? <TouchableOpacity style={styles.addPhotoTile} onPress={pickPhoto}><Ionicons name="add" size={28} color={PURPLE}/><Text style={styles.addPhotoText}>Add photo</Text></TouchableOpacity> : null}
            </View>
            <Text style={styles.helper}>Add up to 10 photos. Adjust, crop or rotate each photo before uploading.</Text>
            <Text style={styles.inputLabel}>Business category</Text>
            <TouchableOpacity style={styles.selectField} onPress={() => { setPicker("category"); setPickerSearch(""); }}><Ionicons name="grid-outline" size={19} color={PURPLE}/><Text style={[styles.selectValue, !form.category && styles.placeholder]}>{form.category || "Choose a category"}</Text><Ionicons name="chevron-down" size={18} color="#766987"/></TouchableOpacity>
            <FormField label="Business description" value={form.description} onChangeText={(value) => set("description", value)} placeholder="Tell alumni about your business" multiline icon="reader-outline" maxLength={2000}/>
            <FormField label="Products or services" value={form.services} onChangeText={(value) => set("services", value)} placeholder="What do you offer?" multiline icon="list-outline" maxLength={1000}/>
            <Text style={styles.inputLabel}>Service price range (₹)</Text>
            <View style={styles.priceRow}><TextInput value={form.priceMin} onChangeText={(value) => set("priceMin", value.replace(/\D/g, ""))} placeholder="Minimum" placeholderTextColor="#A8A0B5" keyboardType="number-pad" style={styles.priceInput}/><Text style={styles.priceDash}>to</Text><TextInput value={form.priceMax} onChangeText={(value) => set("priceMax", value.replace(/\D/g, ""))} placeholder="Maximum" placeholderTextColor="#A8A0B5" keyboardType="number-pad" style={styles.priceInput}/></View>
            <FormField label="Navodayans discount (%)" value={form.navodayansDiscount} onChangeText={(value) => set("navodayansDiscount", value.replace(/\D/g, "").slice(0, 3))} placeholder="0" keyboardType="number-pad" icon="pricetag-outline" />
          </> : null}

          {step === 2 ? <>
            <FormField label="Phone number" value={form.phone} onChangeText={(value) => set("phone", value)} placeholder="Business contact number" keyboardType="phone-pad" icon="call-outline" />
            <FormField label="Email" value={form.email} onChangeText={(value) => set("email", value)} placeholder="name@business.com" keyboardType="email-address" icon="mail-outline" autoCapitalize="none" />
            <FormField label="Website (optional)" value={form.website} onChangeText={(value) => set("website", value)} placeholder="https://yourbusiness.com" keyboardType="url" icon="globe-outline" autoCapitalize="none" />
            <View style={styles.formNote}><Ionicons name="lock-closed-outline" size={16} color="#6C5A7B"/><Text style={styles.formNoteText}>Only share contact details that customers may use to reach your business.</Text></View>
          </> : null}

          {step === 3 ? <>
            <FormField label="Facebook (optional)" value={form.facebook} onChangeText={(value) => set("facebook", value)} placeholder="https://facebook.com/…" icon="logo-facebook" autoCapitalize="none" keyboardType="url" />
            <FormField label="LinkedIn (optional)" value={form.linkedin} onChangeText={(value) => set("linkedin", value)} placeholder="https://linkedin.com/…" icon="logo-linkedin" autoCapitalize="none" keyboardType="url" />
            <FormField label="Instagram (optional)" value={form.instagram} onChangeText={(value) => set("instagram", value)} placeholder="https://instagram.com/…" icon="logo-instagram" autoCapitalize="none" keyboardType="url" />
            <FormField label="X (optional)" value={form.xProfile} onChangeText={(value) => set("xProfile", value)} placeholder="https://x.com/…" icon="at-outline" autoCapitalize="none" keyboardType="url" />
          </> : null}

          {step === 4 ? <>
            <FormField label="Address" value={form.address} onChangeText={(value) => set("address", value)} placeholder="Street, building, area" icon="location-outline" />
            <Text style={styles.inputLabel}>State</Text>
            <TouchableOpacity style={styles.selectField} onPress={() => { setPicker("state"); setPickerSearch(""); }}><Ionicons name="map-outline" size={19} color={PURPLE}/><Text style={[styles.selectValue, !form.state && styles.placeholder]}>{form.state || "Choose a state"}</Text><Ionicons name="chevron-down" size={18} color="#766987"/></TouchableOpacity>
            <Text style={styles.inputLabel}>District</Text>
            <TouchableOpacity style={[styles.selectField, !form.state && styles.selectDisabled]} onPress={() => { if (!form.state) return say("Choose a state first."); setPicker("district"); setPickerSearch(""); }}><Ionicons name="navigate-outline" size={19} color={PURPLE}/><Text style={[styles.selectValue, !form.district && styles.placeholder]}>{form.district || (form.state ? "Choose or enter a district" : "Choose a state first")}</Text><Ionicons name="chevron-down" size={18} color="#766987"/></TouchableOpacity>
            <FormField label="Pincode" value={form.pincode} onChangeText={(value) => set("pincode", value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit pincode" keyboardType="number-pad" icon="pin-outline" />
          </> : null}
        </ScrollView>
        <View style={[styles.formFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {formError ? <View style={styles.formError} accessibilityRole="alert"><Ionicons name="alert-circle-outline" size={18} color="#A5283E"/><Text style={styles.formErrorText}>{formError}</Text></View> : null}
          {step < 4 ? <TouchableOpacity style={styles.nextButton} onPress={() => { const errorMessage = validateStep(); if (errorMessage) { setFormError(errorMessage); return; } setFormError(""); setStep((current) => current + 1); }}><Text style={styles.nextButtonText}>Next</Text><Ionicons name="arrow-forward" size={18} color="#fff"/></TouchableOpacity> : <TouchableOpacity style={[styles.nextButton, saving && styles.buttonDisabled]} onPress={() => void publish()} disabled={saving}>{saving ? <ActivityIndicator color="#fff"/> : <><Text style={styles.nextButtonText}>Publish listing</Text><Ionicons name="checkmark-circle-outline" size={19} color="#fff"/></>}</TouchableOpacity>}
          <Text style={styles.footerHint}>{step === 4 ? "Your listing can be updated or deactivated later." : "You can go back and edit any step before publishing."}</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <ImageAdjustmentModal visible={adjustmentVisible} asset={photoToAdjust} title="Adjust business photo" defaultAspect="landscape" onCancel={() => { setAdjustmentVisible(false); setPhotoToAdjust(null); }} onDone={(asset) => { setPhotos((current) => [...current, asset]); setAdjustmentVisible(false); setPhotoToAdjust(null); }}/>

    <Modal visible={picker !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicker(null)}>
      <View style={[styles.pickerModal, { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.pickerHeading}><View style={{ flex: 1 }}><Text style={styles.pickerTitle}>{picker === "state" ? "Choose a state" : picker === "district" ? "Choose a district" : "Choose a category"}</Text><Text style={styles.pickerSub}>{picker === "district" ? "Search a listed district or add your own." : "Select the closest match for your business."}</Text></View><TouchableOpacity onPress={() => setPicker(null)} style={styles.pickerClose}><Ionicons name="close" size={21} color="#554765"/></TouchableOpacity></View>
        <View style={styles.pickerSearch}><Ionicons name="search-outline" size={18} color={PURPLE}/><TextInput value={pickerSearch} onChangeText={setPickerSearch} placeholder={picker === "district" ? "Search or type district name" : "Search"} placeholderTextColor="#A8A0B5" style={styles.pickerSearchInput} autoFocus={picker === "district"}/></View>
        {picker === "district" && pickerSearch.trim() && !filteredPickerOptions.some((item) => item.toLocaleLowerCase() === pickerSearch.trim().toLocaleLowerCase()) ? <TouchableOpacity style={styles.addDistrict} onPress={() => choosePicker(pickerSearch.trim())}><Ionicons name="add-circle-outline" size={19} color={PURPLE}/><Text style={styles.addDistrictText}>Use “{pickerSearch.trim()}” as district</Text></TouchableOpacity> : null}
        <FlatList data={filteredPickerOptions} keyExtractor={(item) => item} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <TouchableOpacity style={styles.pickerItem} onPress={() => choosePicker(item)}><Text style={styles.pickerItemText}>{item}</Text><Ionicons name="chevron-forward" size={17} color="#B3AABD"/></TouchableOpacity>} ListEmptyComponent={<Text style={styles.pickerEmpty}>{picker === "district" ? "Type the district name above to add it." : "No matches found."}</Text>} />
      </View>
    </Modal>

    <Modal visible={detailLoading} transparent animationType="fade"><View style={styles.loadingScrim}><ActivityIndicator size="large" color="#fff"/><Text style={styles.loadingText}>Opening business…</Text></View></Modal>
    <Modal visible={!!detail} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetail(null)}>
      {detail ? <View style={styles.detailScreen}>
        <View style={[styles.detailHeader, { paddingTop: Math.max(insets.top, 10) + 6 }]}><TouchableOpacity onPress={() => setDetail(null)} style={styles.detailIcon}><Ionicons name="arrow-back" size={21} color={PURPLE_DARK}/></TouchableOpacity><Text style={styles.detailHeaderTitle}>Business details</Text><TouchableOpacity onPress={() => void Share.share({ message: `${detail.name}\n${detail.description}\n${detail.district}, ${detail.state}` })} style={styles.detailIcon}><Ionicons name="share-social-outline" size={20} color={PURPLE_DARK}/></TouchableOpacity></View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
          <View style={[styles.detailGallery, { height: Math.min(width * 0.72, 420) }]}>
            {detail.mediaUrls?.length ? <><ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setGalleryIndex(Math.round(event.nativeEvent.contentOffset.x / width))}>{detail.mediaUrls.map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} style={{ width, height: Math.min(width * 0.72, 420) }} resizeMode="cover"/>)}</ScrollView><View style={styles.galleryCount}><Text style={styles.galleryCountText}>{galleryIndex + 1} of {detail.mediaUrls.length}</Text></View></> : <View style={styles.detailPlaceholder}><Ionicons name="business" size={56} color="#B7A0D0"/><Text style={styles.placeholderCaption}>Alumni business</Text></View>}
          </View>
          <View style={styles.detailContent}>
            <View style={styles.namePriceRow}><Text style={styles.detailName}>{detail.name}</Text><Text style={styles.priceText}>{formatPrice(detail)}</Text></View>
            <View style={styles.ratingRow}><View style={styles.stars}>{Array.from({ length: 5 }, (_, index) => <Ionicons key={index} name={index < Math.round(detail.rating ?? 0) ? "star" : "star-outline"} size={19} color="#E5A72B"/>)}</View><Text style={styles.ratingNumber}>{(detail.rating ?? 0).toFixed(1)}</Text><TouchableOpacity onPress={() => void Share.share({ message: `${detail.name} · ${detail.district}, ${detail.state}` })} style={{ marginLeft: "auto" }}><Ionicons name="share-social-outline" size={21} color="#8B8394"/></TouchableOpacity></View>
            <View style={styles.discountRow}><Ionicons name="pricetag" size={17} color={PURPLE}/><Text style={styles.discountText}>Navodayans discount: {detail.navodayansDiscount ?? 0}%</Text><View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{detail.category}</Text></View></View>
            <Text numberOfLines={expandedDescription ? undefined : 3} style={styles.detailDescription}>{detail.description || "This alumni business has not added a description yet."}{detail.services ? `\n\n${detail.services}` : ""}</Text>
            {detail.description.length > 130 || detail.services ? <TouchableOpacity onPress={() => setExpandedDescription((value) => !value)}><Text style={styles.showMore}>{expandedDescription ? "Show less" : "Show more"}</Text></TouchableOpacity> : null}
            <View style={styles.ownerFacts}>
              <OwnerFact icon="business-outline" label="Business name" value={detail.name}/><OwnerFact icon="person-outline" label="Owner" value={detail.ownerName || "Not provided"}/><OwnerFact icon="person-circle-outline" label="Listed by" value={detail.applicantName || "Alumni"}/>
            </View>
            <View style={styles.addressBlock}><Ionicons name="location-outline" size={20} color={PURPLE_DARK}/><Text style={styles.addressText}>{[detail.address, detail.district, detail.state, detail.pincode].filter(Boolean).join(", ")}</Text></View>
            <View style={styles.contactButtons}>
              {detail.phone ? <TouchableOpacity style={styles.contactButton} onPress={() => void Linking.openURL(`tel:${detail.phone}`)}><Ionicons name="call-outline" size={19} color="#fff"/><Text style={styles.contactButtonText}>Call</Text></TouchableOpacity> : null}
              {detail.email ? <TouchableOpacity style={styles.contactButton} onPress={() => void Linking.openURL(`mailto:${detail.email}`)}><Ionicons name="mail-outline" size={19} color="#fff"/><Text style={styles.contactButtonText}>Mail</Text></TouchableOpacity> : null}
              {!detail.phone && !detail.email && detail.website ? <TouchableOpacity style={styles.contactButton} onPress={() => void Linking.openURL(detail.website!)}><Ionicons name="globe-outline" size={19} color="#fff"/><Text style={styles.contactButtonText}>Visit website</Text></TouchableOpacity> : null}
            </View>
            {detail.website ? <TouchableOpacity style={styles.websiteLink} onPress={() => void Linking.openURL(detail.website!)}><Ionicons name="open-outline" size={16} color={PURPLE}/><Text style={styles.websiteText}>{detail.website}</Text></TouchableOpacity> : null}
            <SocialLinks business={detail}/>
          </View>
          <View style={styles.reviewsHeader}><Text style={styles.reviewsTitle}>Reviews ({detail.reviewsCount ?? detail.reviews.length})</Text><TouchableOpacity onPress={() => setShowAllReviews((value) => !value)}><Text style={styles.viewAll}>{showAllReviews ? "Show less" : "View all"}</Text></TouchableOpacity></View>
          {detail.reviews.length ? detail.reviews.slice(0, showAllReviews ? detail.reviews.length : 3).map((review) => <ReviewCard key={review.id} review={review}/>) : <Text style={styles.noReviews}>No reviews yet. Share your experience with alumni.</Text>}
          {isAlumni && detail.ownerId !== profile?.uid ? <TouchableOpacity style={styles.writeReview} onPress={() => setReviewVisible(true)}><Ionicons name="star-outline" size={18} color={PURPLE}/><Text style={styles.writeReviewText}>Write a review</Text></TouchableOpacity> : null}
          {detail.ownerId === profile?.uid ? <TouchableOpacity style={styles.deactivateButton} onPress={async () => { try { await api.businesses.update(detail.id, { status: "inactive" }); setDetail(null); await load(true); say("Your business listing is now inactive."); } catch (err) { say(err instanceof Error ? err.message : "Could not deactivate the listing."); } }}><Ionicons name="eye-off-outline" size={17} color="#8B3542"/><Text style={styles.deactivateText}>Deactivate listing</Text></TouchableOpacity> : <TouchableOpacity style={styles.reportButton} onPress={() => void report()}><Ionicons name="flag-outline" size={15} color="#7D7488"/><Text style={styles.reportText}>Report listing</Text></TouchableOpacity>}
        </ScrollView>
      </View> : null}
    </Modal>

    <Modal visible={reviewVisible} transparent animationType="fade" onRequestClose={() => setReviewVisible(false)}><View style={styles.reviewScrim}><View style={styles.reviewModal}><Text style={styles.reviewModalTitle}>Rate this business</Text><Text style={styles.reviewModalSub}>Your review helps the alumni community.</Text><View style={styles.ratingPicker}>{Array.from({ length: 5 }, (_, index) => <TouchableOpacity key={index} onPress={() => setReviewRating(index + 1)}><Ionicons name={index < reviewRating ? "star" : "star-outline"} size={32} color="#E5A72B"/></TouchableOpacity>)}</View><TextInput value={reviewText} onChangeText={setReviewText} style={styles.reviewInput} placeholder="Share a few details (optional)" placeholderTextColor="#A8A0B5" multiline maxLength={1000}/><TouchableOpacity style={styles.nextButton} onPress={() => void submitReview()} disabled={savingReview}>{savingReview ? <ActivityIndicator color="#fff"/> : <Text style={styles.nextButtonText}>Submit review</Text>}</TouchableOpacity><TouchableOpacity onPress={() => setReviewVisible(false)} style={styles.cancelReview}><Text style={styles.cancelReviewText}>Cancel</Text></TouchableOpacity></View></View></Modal>

    {toast ? <View style={[styles.toast, { bottom: insets.bottom + 82 }]}><Text style={styles.toastText}>{toast}</Text></View> : null}
  </View>;
}

function BusinessCard({ item, onPress, width, featured = false }: { item: Business; onPress: () => void; width?: number; featured?: boolean }) {
  return <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={[styles.businessCard, width ? { width } : null, featured && styles.featuredCard]}>
    <View style={styles.cardTop}><View style={styles.networkTag}><Ionicons name="people-outline" size={13} color={PURPLE}/><Text style={styles.networkTagText}>Navodaya network</Text></View><View style={styles.cardCategory}><Text numberOfLines={1} style={styles.cardCategoryText}>{item.category}</Text></View></View>
    {item.mediaUrls?.[0] ? <Image source={{ uri: item.mediaUrls[0] }} style={styles.cardImage} resizeMode="cover"/> : <View style={[styles.cardImage, styles.cardImageEmpty]}><View style={styles.cardImageIcon}><Ionicons name="business" size={31} color={PURPLE}/></View><Text style={styles.cardImageHint}>Navodaya alumni business</Text></View>}
    <View style={styles.cardBody}><View style={styles.cardNamePrice}><Text numberOfLines={1} style={styles.cardName}>{item.name}</Text><Text style={styles.cardPrice}>{formatPrice(item)}</Text></View>
      <View style={styles.cardMeta}><Ionicons name="location-outline" size={16} color="#8D8496"/><Text numberOfLines={1} style={styles.cardAddress}>{[item.district || item.city, item.state].filter(Boolean).join(", ") || "Location not provided"}</Text><View style={styles.miniStars}><Ionicons name="star" size={15} color="#D9A333"/><Text style={styles.miniRating}>{(item.rating ?? 0).toFixed(1)}</Text></View></View>
      <Text numberOfLines={2} style={styles.cardDescription}>{item.description || item.services || "View business details, contact information and customer reviews."}</Text>
      {item.navodayansDiscount ? <View style={styles.cardOffer}><Ionicons name="pricetag-outline" size={14} color={PURPLE}/><Text style={styles.cardOfferText}>{item.navodayansDiscount}% Navodayans discount</Text></View> : null}
    </View>
  </TouchableOpacity>;
}

function FormField({ label, value, onChangeText, placeholder, multiline, icon, ...inputProps }: { label: string; icon: IconName; multiline?: boolean } & TextInputProps) {
  return <View style={styles.fieldWrap}><Text style={styles.inputLabel}>{label}</Text><View style={[styles.fieldBox, multiline && styles.multilineBox]}><Ionicons name={icon} size={18} color={PURPLE}/><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#A8A0B5" style={[styles.fieldInput, multiline && styles.multilineInput]} multiline={multiline} {...inputProps}/></View></View>;
}

function OwnerFact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return <View style={styles.ownerFact}><Ionicons name={icon} size={21} color={PURPLE_DARK}/><Text numberOfLines={1} style={styles.ownerFactLabel}>{label}</Text><Text numberOfLines={1} style={styles.ownerFactValue}>{value}</Text></View>;
}

function ReviewCard({ review }: { review: BusinessReview }) {
  return <View style={styles.reviewCard}><View style={styles.reviewTop}><View style={styles.reviewerAvatar}><Text style={styles.reviewerInitial}>{(review.reviewerName || "A").slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.reviewerName}>{review.reviewerName || "Navodaya alumnus"}</Text><Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text></View><View style={styles.reviewStars}>{Array.from({ length: 5 }, (_, index) => <Ionicons key={index} name={index < review.rating ? "star" : "star-outline"} size={13} color="#D9A333"/>)}</View></View>{review.review ? <Text style={styles.reviewBody}>{review.review}</Text> : null}</View>;
}

function SocialLinks({ business }: { business: BusinessDetails }) {
  const links = ([
    { key: business.facebook, icon: "logo-facebook", label: "Facebook" },
    { key: business.linkedin, icon: "logo-linkedin", label: "LinkedIn" },
    { key: business.instagram, icon: "logo-instagram", label: "Instagram" },
    { key: business.xProfile, icon: "at-outline", label: "X" },
  ] as { key: string | undefined; icon: IconName; label: string }[]).filter((item) => item.key);
  return links.length ? <View style={styles.socialRow}>{links.map((item) => <TouchableOpacity key={item.label} style={styles.socialButton} onPress={() => item.key && void Linking.openURL(item.key)}><Ionicons name={item.icon} size={18} color={PURPLE}/><Text style={styles.socialLabel}>{item.label}</Text></TouchableOpacity>)}</View> : null;
}

function formatPrice(item: Business) {
  if (item.priceMin == null && item.priceMax == null) return "Contact";
  const low = item.priceMin == null ? "0" : item.priceMin.toLocaleString("en-IN");
  const high = item.priceMax == null ? low : item.priceMax.toLocaleString("en-IN");
  return `₹${low} – ${high}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F7FF" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 11 },
  headerBack: { width: 42, height: 42, borderRadius: 15, backgroundColor: PURPLE_PALE, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: "#4B6EF5", fontSize: 10, letterSpacing: 1.05, fontFamily: "Inter_700Bold" }, pageTitle: { color: PURPLE_DARK, fontSize: 21, lineHeight: 27, fontFamily: "Inter_700Bold" },
  headerAdd: { minHeight: 42, borderRadius: 14, backgroundColor: PURPLE, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 10, shadowColor: PURPLE, shadowOpacity: 0.16, shadowRadius: 7, elevation: 3 }, headerAddText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  communityBanner: { flexDirection: "row", alignItems: "center", gap: 11, marginHorizontal: 18, marginTop: 15, marginBottom: 15, padding: 13, borderRadius: 16, backgroundColor: "#EAF0FF", borderWidth: 1, borderColor: "#DDE6FF", overflow: "hidden" }, communityMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }, communityTitle: { color: "#1D2A53", fontSize: 13, fontFamily: "Inter_700Bold" }, communityCopy: { color: "#65728B", fontSize: 11, lineHeight: 16, marginTop: 2, fontFamily: "Inter_400Regular" }, communityAccent: { position: "absolute", right: -18, top: -25, width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(16,185,129,0.12)" },
  searchWrap: { height: 50, marginHorizontal: 18, paddingHorizontal: 14, backgroundColor: "#fff", borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#E5EAF2" }, searchInput: { flex: 1, color: PURPLE_DARK, fontSize: 14, fontFamily: "Inter_400Regular" },
  locationSearch: { flexDirection: "row", alignItems: "center", gap: 9, marginHorizontal: 18, marginTop: 9, marginBottom: 16, height: 44, paddingHorizontal: 13, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5EAF2", borderRadius: 13 }, locationSearchActive: { borderColor: "#A8BAFF" }, locationInput: { flex: 1, color: PURPLE_DARK, fontSize: 13, fontFamily: "Inter_400Regular" },
  categoryBlock: { marginBottom: 2 }, categoryHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 10 }, categoryHeading: { fontSize: 16, color: PURPLE_DARK, fontFamily: "Inter_700Bold" }, categorySubheading: { color: "#8A94A4", marginTop: 2, fontSize: 11, fontFamily: "Inter_400Regular" }, categoryChips: { paddingHorizontal: 18, gap: 8, paddingBottom: 3 }, categoryChip: { minHeight: 37, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7F0" }, categoryChipActive: { backgroundColor: PURPLE, borderColor: PURPLE }, categoryChipText: { color: "#536078", fontSize: 11, fontFamily: "Inter_600SemiBold" }, categoryChipTextActive: { color: "#fff" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 19, marginTop: 22, marginBottom: 11 }, sectionTitle: { color: PURPLE_DARK, fontSize: 17, fontFamily: "Inter_700Bold" }, sectionCaption: { color: "#7B879B", marginTop: 3, fontSize: 11, fontFamily: "Inter_400Regular" }, viewAll: { color: PURPLE, fontSize: 13, fontFamily: "Inter_600SemiBold" }, featuredScroll: { paddingHorizontal: 17, gap: 12, paddingBottom: 3 },
  businessCard: { backgroundColor: "#fff", borderRadius: 18, padding: 12, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E7EBF1", shadowColor: "#15284D", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }, featuredCard: { marginHorizontal: 0, marginBottom: 4 }, cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 2, marginBottom: 9 }, networkTag: { flexDirection: "row", alignItems: "center", gap: 5 }, networkTagText: { color: "#65728B", fontSize: 10, fontFamily: "Inter_600SemiBold" }, cardCategory: { maxWidth: 115, backgroundColor: PURPLE_PALE, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 11 }, cardCategoryText: { color: PURPLE, fontSize: 10, fontFamily: "Inter_600SemiBold" }, cardImage: { width: "100%", height: 164, borderRadius: 13, backgroundColor: "#E9EEF8" }, cardImageEmpty: { alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#F5F3FF" }, cardImageIcon: { height: 56, width: 56, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }, cardImageHint: { color: "#63749A", fontSize: 11, fontFamily: "Inter_500Medium" }, cardBody: { paddingHorizontal: 2, paddingTop: 11 }, cardNamePrice: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, cardName: { flex: 1, color: "#18213B", fontSize: 16, fontFamily: "Inter_700Bold" }, cardPrice: { color: PURPLE, fontSize: 14, fontFamily: "Inter_700Bold" }, cardMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 }, cardAddress: { flex: 1, minWidth: 0, color: "#69768C", fontSize: 11, fontFamily: "Inter_400Regular" }, miniStars: { flexDirection: "row", alignItems: "center", gap: 3 }, miniRating: { color: "#536078", fontSize: 11, fontFamily: "Inter_500Medium" }, cardDescription: { color: "#536078", fontSize: 12, lineHeight: 18, marginTop: 9, fontFamily: "Inter_400Regular" }, cardOffer: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 }, cardOfferText: { color: "#078A62", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  listings: { paddingBottom: 10 }, empty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 30, paddingVertical: 42, gap: 10 }, emptyInline: { marginHorizontal: 18, backgroundColor: "#fff", borderRadius: 18, padding: 22, flexDirection: "row", alignItems: "center", gap: 12 }, emptyTitle: { color: PURPLE_DARK, fontSize: 16, fontFamily: "Inter_700Bold" }, emptyText: { textAlign: "center", color: "#756B80", fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" }, muted: { color: "#92899C", fontSize: 12, fontFamily: "Inter_400Regular" }, loadingBox: { alignItems: "center", padding: 25, gap: 9 }, errorText: { color: "#AE3446", marginHorizontal: 22, marginBottom: 10 }, infoBanner: { flexDirection: "row", alignItems: "center", gap: 8, margin: 18, padding: 13, borderRadius: 13, backgroundColor: "#EFE8F7" }, infoText: { flex: 1, color: PURPLE_DARK, fontSize: 11, fontFamily: "Inter_500Medium" },
  formScreen: { flex: 1, backgroundColor: "#fff" }, formHeader: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderColor: "#F1EDF4" }, formBack: { width: 40, height: 40, borderRadius: 14, backgroundColor: PURPLE_PALE, alignItems: "center", justifyContent: "center" }, formHeaderTitle: { color: PURPLE_DARK, fontSize: 16, fontFamily: "Inter_700Bold" }, formHeaderSub: { color: "#958C9E", fontSize: 11, marginTop: 2, fontFamily: "Inter_400Regular" }, formClose: { width: 38, height: 38, alignItems: "center", justifyContent: "center" }, progressRow: { flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 14 }, formError: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginHorizontal: 22, marginBottom: 9, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "#FFF0F1", borderWidth: 1, borderColor: "#F6D1D5" }, formErrorText: { flex: 1, color: "#8F2437", fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" }, progressSegment: { flex: 1, height: 5, backgroundColor: "#DCD8E0", borderRadius: 4 }, progressSegmentActive: { backgroundColor: PURPLE }, formBody: { paddingHorizontal: 24, paddingTop: 17, paddingBottom: 32 }, formHeroIcon: { width: 58, height: 58, alignSelf: "center", borderRadius: 20, backgroundColor: PURPLE_PALE, alignItems: "center", justifyContent: "center", marginBottom: 10 }, formTitle: { color: PURPLE_DARK, textAlign: "center", fontSize: 23, fontFamily: "Inter_700Bold" }, formSubtitle: { color: "#857B90", textAlign: "center", fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 22, fontFamily: "Inter_400Regular" }, fieldWrap: { marginTop: 16 }, inputLabel: { color: "#2D2437", fontSize: 14, marginBottom: 8, fontFamily: "Inter_600SemiBold" }, fieldBox: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, paddingHorizontal: 14, backgroundColor: "#F8F9FC", borderWidth: 1, borderColor: "#E5EAF2" }, fieldInput: { flex: 1, color: "#2D2437", fontSize: 15, minHeight: 50, fontFamily: "Inter_400Regular" }, multilineBox: { alignItems: "flex-start", paddingTop: 13 }, multilineInput: { minHeight: 96, textAlignVertical: "top", paddingTop: 0 }, selectField: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#F8F9FC", borderWidth: 1, borderColor: "#E5EAF2" }, selectValue: { flex: 1, color: "#2D2437", fontSize: 15, fontFamily: "Inter_500Medium" }, placeholder: { color: "#A8A0B5" }, selectDisabled: { opacity: 0.65 }, helper: { color: "#938AA0", fontSize: 11, marginTop: 8, lineHeight: 16, fontFamily: "Inter_400Regular" }, photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, photoThumbWrap: { width: 88, height: 88, borderRadius: 14, overflow: "hidden", position: "relative" }, photoThumb: { width: "100%", height: "100%" }, photoRemove: { position: "absolute", top: 5, right: 5, width: 23, height: 23, borderRadius: 12, backgroundColor: "rgba(31,22,44,0.76)", alignItems: "center", justifyContent: "center" }, addPhotoTile: { width: 88, height: 88, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#A8BAFF", backgroundColor: "#FBF9FD", alignItems: "center", justifyContent: "center" }, addPhotoText: { color: PURPLE, fontSize: 10, fontFamily: "Inter_600SemiBold" }, priceRow: { flexDirection: "row", alignItems: "center", gap: 10 }, priceInput: { flex: 1, height: 50, paddingHorizontal: 13, borderRadius: 13, backgroundColor: "#F8F9FC", color: PURPLE_DARK, fontSize: 14, fontFamily: "Inter_500Medium" }, priceDash: { color: "#938AA0", fontSize: 12, fontFamily: "Inter_500Medium" }, formNote: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 20, padding: 13, borderRadius: 13, backgroundColor: "#F5F3FF" }, formNoteText: { flex: 1, color: "#6D617A", fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" }, formFooter: { borderTopWidth: 1, borderColor: "#F1EDF4", backgroundColor: "#fff", paddingHorizontal: 22, paddingTop: 12 }, nextButton: { minHeight: 54, borderRadius: 15, backgroundColor: PURPLE, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, nextButtonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" }, buttonDisabled: { opacity: 0.65 }, footerHint: { textAlign: "center", color: "#9B92A4", marginTop: 8, fontSize: 10, fontFamily: "Inter_400Regular" },
  pickerModal: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 20 }, pickerHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }, pickerTitle: { color: PURPLE_DARK, fontSize: 20, fontFamily: "Inter_700Bold" }, pickerSub: { color: "#90869B", marginTop: 4, fontSize: 12, fontFamily: "Inter_400Regular" }, pickerClose: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }, pickerSearch: { height: 48, borderRadius: 13, backgroundColor: PURPLE_PALE, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, marginBottom: 9 }, pickerSearchInput: { flex: 1, color: PURPLE_DARK, fontSize: 14 }, pickerItem: { height: 53, borderBottomWidth: 1, borderColor: "#E5EAF2", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pickerItemText: { color: "#33283D", fontSize: 14, fontFamily: "Inter_500Medium" }, pickerEmpty: { textAlign: "center", color: "#8F859A", padding: 25, fontSize: 12, fontFamily: "Inter_400Regular" }, addDistrict: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#F5F3FF", marginBottom: 4 }, addDistrictText: { color: PURPLE, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  detailScreen: { flex: 1, backgroundColor: "#fff" }, detailHeader: { minHeight: 58, paddingHorizontal: 15, paddingBottom: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#E5EAF2" }, detailIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: PURPLE_PALE, alignItems: "center", justifyContent: "center" }, detailHeaderTitle: { flex: 1, textAlign: "center", color: PURPLE_DARK, fontSize: 16, fontFamily: "Inter_700Bold" }, detailGallery: { height: 260, position: "relative", backgroundColor: "#F8F7FF" }, galleryCount: { position: "absolute", bottom: 12, alignSelf: "center", borderRadius: 14, backgroundColor: "rgba(36,20,53,0.78)", paddingHorizontal: 13, paddingVertical: 6 }, galleryCountText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" }, detailPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }, placeholderCaption: { color: "#65728B", fontSize: 12, fontFamily: "Inter_600SemiBold" }, detailContent: { paddingHorizontal: 21, paddingTop: 18 }, namePriceRow: { flexDirection: "row", alignItems: "center", gap: 10 }, detailName: { flex: 1, color: "#1F1530", fontSize: 22, fontFamily: "Inter_700Bold" }, priceText: { color: PURPLE, fontSize: 17, fontFamily: "Inter_700Bold" }, ratingRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12 }, stars: { flexDirection: "row", gap: 2 }, ratingNumber: { color: "#352A40", fontSize: 15, fontFamily: "Inter_600SemiBold" }, discountRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 18, flexWrap: "wrap" }, discountText: { color: "#34263F", fontSize: 14, fontFamily: "Inter_500Medium" }, categoryBadge: { marginLeft: "auto", backgroundColor: PURPLE_PALE, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 6 }, categoryBadgeText: { color: PURPLE, fontSize: 10, fontFamily: "Inter_600SemiBold" }, detailDescription: { color: "#536078", fontSize: 14, lineHeight: 22, marginTop: 17, fontFamily: "Inter_400Regular" }, showMore: { color: PURPLE, fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 5 }, ownerFacts: { flexDirection: "row", marginTop: 21, paddingVertical: 17, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E8E3EA" }, ownerFact: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 7, borderRightWidth: 1, borderColor: "#E3DEE7", gap: 5 }, ownerFactLabel: { color: "#847B8D", fontSize: 10, fontFamily: "Inter_400Regular" }, ownerFactValue: { maxWidth: "100%", color: "#30243C", fontSize: 12, fontFamily: "Inter_600SemiBold" }, addressBlock: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 19 }, addressText: { flex: 1, color: "#30243C", fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular" }, contactButtons: { flexDirection: "row", justifyContent: "center", gap: 24, marginTop: 18 }, contactButton: { minWidth: 124, height: 52, borderRadius: 17, paddingHorizontal: 20, backgroundColor: PURPLE, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, contactButtonText: { color: "#fff", fontSize: 17, fontFamily: "Inter_600SemiBold" }, websiteLink: { alignSelf: "center", maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 13 }, websiteText: { flexShrink: 1, color: PURPLE, fontSize: 12, fontFamily: "Inter_500Medium" }, socialRow: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 8, marginTop: 16 }, socialButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 14, backgroundColor: PURPLE_PALE }, socialLabel: { color: PURPLE, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  reviewsHeader: { marginTop: 24, backgroundColor: "#F3F4F6", paddingHorizontal: 21, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, reviewsTitle: { color: "#241A30", fontSize: 17, fontFamily: "Inter_600SemiBold" }, noReviews: { color: "#8F8599", paddingVertical: 22, paddingHorizontal: 22, fontSize: 12, fontFamily: "Inter_400Regular" }, reviewCard: { paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: "#E5EAF2" }, reviewTop: { flexDirection: "row", alignItems: "center", gap: 9 }, reviewerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: PURPLE_PALE, alignItems: "center", justifyContent: "center" }, reviewerInitial: { color: PURPLE, fontSize: 14, fontFamily: "Inter_700Bold" }, reviewerName: { color: "#33283D", fontSize: 12, fontFamily: "Inter_600SemiBold" }, reviewDate: { color: "#9C93A5", fontSize: 10, marginTop: 2, fontFamily: "Inter_400Regular" }, reviewStars: { flexDirection: "row", gap: 1 }, reviewBody: { color: "#6E6577", fontSize: 12, lineHeight: 18, marginTop: 9, marginLeft: 43, fontFamily: "Inter_400Regular" }, writeReview: { marginHorizontal: 20, marginTop: 13, minHeight: 45, borderRadius: 14, borderWidth: 1, borderColor: "#C7D2FE", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, writeReviewText: { color: PURPLE, fontSize: 13, fontFamily: "Inter_600SemiBold" }, deactivateButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 19, padding: 10 }, deactivateText: { color: "#8B3542", fontSize: 12, fontFamily: "Inter_600SemiBold" }, reportButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 16, padding: 9 }, reportText: { color: "#7D7488", fontSize: 11, fontFamily: "Inter_500Medium" },
  loadingScrim: { flex: 1, backgroundColor: "rgba(32,15,48,0.72)", alignItems: "center", justifyContent: "center", gap: 12 }, loadingText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" }, reviewScrim: { flex: 1, backgroundColor: "rgba(23,13,33,0.5)", justifyContent: "center", padding: 20 }, reviewModal: { borderRadius: 23, backgroundColor: "#fff", padding: 22 }, reviewModalTitle: { color: PURPLE_DARK, fontSize: 20, textAlign: "center", fontFamily: "Inter_700Bold" }, reviewModalSub: { color: "#8D8298", fontSize: 12, textAlign: "center", marginTop: 5, fontFamily: "Inter_400Regular" }, ratingPicker: { flexDirection: "row", justifyContent: "center", gap: 8, marginVertical: 20 }, reviewInput: { minHeight: 100, textAlignVertical: "top", padding: 13, borderRadius: 14, backgroundColor: "#F8F9FC", color: PURPLE_DARK, fontSize: 13, marginBottom: 15, fontFamily: "Inter_400Regular" }, cancelReview: { alignItems: "center", padding: 12 }, cancelReviewText: { color: "#80758D", fontSize: 13, fontFamily: "Inter_600SemiBold" }, toast: { position: "absolute", left: 20, right: 20, backgroundColor: "#18213B", borderRadius: 15, paddingHorizontal: 15, paddingVertical: 12, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 }, toastText: { color: "#fff", textAlign: "center", fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" },
});
