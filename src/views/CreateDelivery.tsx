import React, { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { db } from "../lib/firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firestoreUtils";
import {
  Navigation,
  ArrowLeft,
  Loader2,
  Crosshair,
  Package,
  ArrowRight,
  MapPin,
  CheckCircle,
  Plus,
  Info,
  Wallet,
  Smartphone,
  X,
} from "lucide-react";
import { cn, calculateDistance } from "../lib/utils";
import { CommissionSettings } from "../types";
import L from "leaflet";

// @ts-ignore
import markerIcon from "leaflet/dist/images/marker-icon.png";
// @ts-ignore
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const customMarkerIcon = new L.Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconAnchor: [12, 41],
});

const reverseGeocode = async (lat: number, lng: number) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    const data = await res.json();
    return (
      data.display_name.split(",").slice(0, 3).join(",") ||
      "Emplacement inconnu"
    );
  } catch (error) {
    return "Ma position";
  }
};

const RecenterMap = ({ from, to }: { from: any; to: any }) => {
  const map = useMap();
  useEffect(() => {
    if (from && to) {
      const bounds = L.latLngBounds([from.lat, from.lng], [to.lat, to.lng]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (from) {
      map.setView([from.lat, from.lng], 15);
    } else if (to) {
      map.setView([to.lat, to.lng], 15);
    }
  }, [from, to, map]);
  return null;
};

const MapPicker = ({
  onSelect,
}: {
  onSelect: (coords: { lat: number; lng: number; address?: string }) => void;
}) => {
  useMapEvents({
    async click(e) {
      // Set a temporary address to make it feel fast
      onSelect({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        address: "Chargement de l'adresse...",
      });
      const address = await reverseGeocode(e.latlng.lat, e.latlng.lng);
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng, address });
    },
  });
  return null;
};

// Ouagadougou Default Center
const centerOUAGA: [number, number] = [12.3714, -1.5197];

export default function CreateDelivery() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Step Management
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [directionStep, setDirectionStep] = useState<"from" | "to">("from");

  // Adresses
  const [from, setFrom] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [to, setTo] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [fromPrecision, setFromPrecision] = useState("");
  const [toPrecision, setToPrecision] = useState("");

  // Colis Details
  const [size, setSize] = useState<"small" | "medium" | "large">("small");
  const [weight, setWeight] = useState("");
  const [vehicleType, setVehicleType] = useState<
    "moto" | "tricycle" | "camionnette"
  >("moto");
  const [notes, setNotes] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  // Prix
  const [commissionSettings, setCommissionSettings] =
    useState<CommissionSettings | null>(null);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [proposedPrice, setProposedPrice] = useState<number | "">(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [driversAvailable, setDriversAvailable] = useState(0);
  const [driversBusy, setDriversBusy] = useState(0);
  const [distance, setDistance] = useState<number | null>(null);
  const [saveFromAsFavorite, setSaveFromAsFavorite] = useState(false);
  const [saveToAsFavorite, setSaveToAsFavorite] = useState(false);
  const [favoriteLabel, setFavoriteLabel] = useState("");

  // Search & Suggestions
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [suggestions, setSuggestions] = useState<
    { display_name: string; lat: string; lon: string }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&countrycodes=bf&limit=5`
        );
        const data = await res.json();
        setSuggestions(data);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  useEffect(() => {
    if (from?.address) setFromSearch(from.address);
  }, [from?.address]);

  useEffect(() => {
    if (to?.address) setToSearch(to.address);
  }, [to?.address]);

  const handleSelectSuggestion = (suggestion: any, type: "from" | "to") => {
    const coords = {
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
      address: suggestion.display_name.split(",").slice(0, 3).join(","),
    };
    if (type === "from") {
      setFrom(coords);
      setFromSearch(coords.address);
      setDirectionStep("to");
    } else {
      setTo(coords);
      setToSearch(coords.address);
    }
    setSuggestions([]);
  };

  const detectLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return;

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setFrom((prev) => {
          if (!prev) {
            setDirectionStep("to");
            return { lat, lng, address: "Ma position..." };
          }
          return prev;
        });
        setIsDetectingLocation(false);

        try {
          const address = await reverseGeocode(lat, lng);
          setFrom((prev) =>
            prev && prev.lat === lat ? { ...prev, address } : prev
          );
        } catch (e) {
          console.error("Geocoding failed", e);
        }
      },
      (error) => {
        console.warn("Geolocation fallback:", error);
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // Promo Code
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "cash" | "aggregator" | "ussd" | "orange" | "moov" | "telecel" | "coris"
  >("cash");

  useEffect(() => {
    getDoc(doc(db, "settings", "commissions")).then((snap) => {
      if (snap.exists())
        setCommissionSettings(snap.data() as CommissionSettings);
    });

    let unsubRecent: (() => void) | undefined;

    // Pre-fill senderPhone per user request
    if (profile?.userId) {
      if (!senderPhone && profile.phone) {
        setSenderPhone(profile.phone);
      }
      const deliveriesRef = collection(db, "deliveries");
      const qRecent = query(
        deliveriesRef,
        where("clientId", "==", profile.userId)
      );

      unsubRecent = onSnapshot(
        qRecent,
        (snap) => {
          if (!snap.empty) {
            const docs = snap.docs.map((d) => d.data());
            // Sort by createdAt manually since we might not have the index
            const sorted = docs.sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime()
            );
          }
        },
        (error) =>
          handleFirestoreError(error, OperationType.LIST, "deliveries (recent)")
      );
    }

    detectLocation();

    // Check for online drivers
    const unsub = onSnapshot(
      query(
        collection(db, "users"),
        where("role", "in", ["driver", "admin", "superadmin"])
      ),
      (snap) => {
        const drivers = snap.docs.map((d) => d.data());
        // A driver is available if they are online and NOT suspended
        // We include those with pending_approval if they have at least gone online
        const available = drivers.filter(
          (d) => (d.status === "online") && d.accountStatus !== "suspended"
        ).length;
        const busy = drivers.filter(
          (d) => d.status === "busy" && d.accountStatus !== "suspended"
        ).length;

        setDriversAvailable(available);
        setDriversBusy(busy);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "users")
    );
    return () => {
      unsub();
      if (unsubRecent) unsubRecent();
    };
  }, [profile?.userId]);

  const handleApplyPromo = () => {
    if (promoCode.toUpperCase() === "LIVRAISON100") {
      setDiscount(100);
      alert("Promo de 100 F appliquée !");
    } else if (promoCode.toUpperCase() === "FREE") {
      setDiscount(500);
      alert("Promo de 500 F appliquée !");
    } else {
      alert("Code Invalide");
      setDiscount(0);
    }
  };

  // Auto-switch vehicle if weight is high
  useEffect(() => {
    const w = Number(weight || 0);
    if (w > 20) {
      setVehicleType("camionnette");
    } else if (w > 10 || size === "large") {
      setVehicleType("tricycle");
    } else {
      setVehicleType("moto");
    }
  }, [weight, size]);

  // Pricing logic update
  useEffect(() => {
    if (from && to && commissionSettings) {
      const dist = calculateDistance(from.lat, from.lng, to.lat, to.lng);
      setDistance(dist);

      let basePrice = 0;

      if (vehicleType === "moto") {
        if (dist <= 10) basePrice = 1000;
        else if (dist <= 15) basePrice = 1500;
        else basePrice = 1500 + Math.ceil(dist - 15) * 150;
      } else if (vehicleType === "tricycle") {
        // Base 3000 for tricycle, plus 250 per km after 5km
        basePrice = 3000 + (dist > 5 ? Math.ceil(dist - 5) * 250 : 0);
      } else if (vehicleType === "camionnette") {
        // Base 7500 for camionnette, plus 500 per km after 5km
        basePrice = 7500 + (dist > 5 ? Math.ceil(dist - 5) * 500 : 0);
      }

      // Weight adds a small buffer for Moto only?
      if (vehicleType === "moto") {
        basePrice += Number(weight || 0) * 100;
      }

      if (isUrgent) {
        basePrice += 500; // Urgent fee
      }

      const finalBase = Math.max(0, basePrice - discount);

      setEstimatedCost(Math.round(finalBase));
      setProposedPrice(Math.round(finalBase));

      fetch(
        `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
      )
        .then((res) => {
          if (!res.ok) throw new Error("Network response was not ok");
          return res.json();
        })
        .then((data) => {
          if (data.routes && data.routes.length > 0) {
            setRouteCoords(
              data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]])
            );
          }
        })
        .catch((e) => {
          console.log("Routing error (OSRM blocked or unavailable)", e);
          // Fallback to straight line
          setRouteCoords([[from.lat, from.lng], [to.lat, to.lng]]);
        });
    }
  }, [from, to, commissionSettings, weight, discount, isUrgent, vehicleType]);

  const handleCreate = async () => {
    if (!profile || !from || !to) return;
    setIsSubmitting(true);
    try {
      // Generate a 6-digit PIN code
      const pinCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Save to favorites if requested
      if (saveFromAsFavorite && from && profile) {
        // Logic to update profile favorites would go here if we had an updateProfile helper
        // Since we are in the flow, we won't block the delivery but ideally we update Firestore
      }

      const deliveryData = {
        id: crypto.randomUUID(), // Utiliser un UUID pour SQL
        clientId: profile.userId,
        clientName: profile.name,
        fromAddress: from.address,
        toAddress: to.address,
        fromLat: from.lat,
        fromLng: from.lng,
        toLat: to.lat,
        toLng: to.lng,
        senderPhone: senderPhone || profile.phone || "",
        recipientPhone,
        vehicleType,
        packageSize: size,
        description: notes,
        cost: Number(proposedPrice),
        isUrgent: isUrgent ? 1 : 0,
        paymentStatus: 'pending',
        status: "pending",
        pickupTime: new Date().toISOString(),
      };

      await api.createDelivery(deliveryData);
      navigate(`/delivery/${deliveryData.id}`);
    } catch (e) {
      console.error(e);
      alert("Erreur création");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans relative overflow-hidden">
      {/* Header - Transparent over Map in Step 1 */}
      <header className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center justify-between">
        <button
          onClick={() =>
            step === 1 ? navigate(-1) : setStep((step - 1) as 1 | 2 | 3)
          }
          className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg border border-slate-100"
        >
          <ArrowLeft className="w-5 h-5 text-slate-900" />
        </button>
        <span className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
          Étape {step}/3
        </span>
      </header>

      {/* Dynamic Backgrounds */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          step === 1 ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
        )}
      >
        <MapContainer
          center={centerOUAGA}
          zoom={13}
          className="w-full h-full"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            subdomains={["mt0", "mt1", "mt2", "mt3"]}
          />
          <RecenterMap from={from} to={to} />
          <MapPicker
            onSelect={(coords) => {
              if (directionStep === "from") {
                setFrom(coords);
                setDirectionStep("to");
              } else {
                setTo(coords);
              }
            }}
          />
          {routeCoords.length > 0 && (
            <Polyline
              positions={routeCoords}
              color="#4f46e5"
              weight={4}
              dashArray="10,10"
            />
          )}
          {from && (
            <Marker position={[from.lat, from.lng]} icon={customMarkerIcon} />
          )}
          {to && <Marker position={[to.lat, to.lng]} icon={customMarkerIcon} />}
        </MapContainer>
      </div>

      {/* Step 1: Fiche Coulissante Adresses */}
      <AnimatePresence>
        {step === 1 && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col max-h-[75vh] overflow-y-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] xl:pb-8"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black">Adresses</h2>
                {distance && (
                  <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                    {distance.toFixed(1)} km
                  </div>
                )}
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                  driversAvailable > 0
                    ? "bg-emerald-50 text-emerald-600"
                    : driversBusy > 0
                    ? "bg-orange-50 text-orange-600"
                    : "bg-rose-50 text-rose-600"
                )}
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    driversAvailable > 0
                      ? "bg-emerald-500 animate-pulse"
                      : driversBusy > 0
                      ? "bg-orange-500"
                      : "bg-rose-500"
                  )}
                />
                {driversAvailable > 0
                  ? `${driversAvailable} Livreur${
                      driversAvailable > 1 ? "s" : ""
                    }`
                  : driversBusy > 0
                  ? "Occupés"
                  : "Aucun livreur"}
              </div>
            </div>
            <div className="space-y-2.5 relative">
              {/* Favorites Selector if profile has them */}
              {profile?.favoriteAddresses &&
                profile.favoriteAddresses.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 mb-1 hide-scrollbar">
                    {profile.favoriteAddresses.map((fav) => (
                      <button
                        key={fav.id}
                        onClick={() => {
                          if (directionStep === "from") {
                            setFrom({
                              lat: fav.lat,
                              lng: fav.lng,
                              address: fav.address,
                            });
                            setFromPrecision(fav.precision || "");
                            setDirectionStep("to");
                          } else {
                            setTo({
                              lat: fav.lat,
                              lng: fav.lng,
                              address: fav.address,
                            });
                            setToPrecision(fav.precision || "");
                          }
                        }}
                        className="px-2.5 py-1 bg-slate-100 rounded-full text-[9px] font-bold text-slate-600 border border-slate-200 shrink-0 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition-all flex items-center gap-1.5"
                      >
                        <MapPin className="w-3 h-3" />
                        {fav.label}
                      </button>
                    ))}
                  </div>
                )}

              <div className="absolute left-2.5 top-5 bottom-5 w-0.5 bg-slate-100" />
              <div
                onClick={() => setDirectionStep("from")}
                className={cn(
                  "flex flex-col gap-1.5 p-2.5 rounded-2xl border-2 transition-all cursor-pointer bg-white relative z-10",
                  directionStep === "from"
                    ? "border-indigo-500"
                    : "border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 border-2 border-white">
                    <div className="w-1 h-1 bg-white rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                      Départ
                    </p>
                    <input
                      type="text"
                      value={fromSearch}
                      onChange={(e) => {
                        setFromSearch(e.target.value);
                        fetchSuggestions(e.target.value);
                      }}
                      onFocus={() => {
                        setDirectionStep("from");
                        fetchSuggestions(fromSearch);
                      }}
                      placeholder={
                        isDetectingLocation
                          ? "Recherche de votre position..."
                          : "Saisir ou cliquer sur la carte..."
                      }
                      className="w-full bg-transparent border-none font-bold text-sm outline-none p-0 h-5 placeholder:text-slate-300"
                    />
                  </div>
                  {isDetectingLocation && (
                    <Loader2 className="w-4 h-4 animate-spin text-orange-500 mr-2" />
                  )}
                  {!from && !isDetectingLocation && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        detectLocation();
                      }}
                      className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors mr-2"
                      title="Ma position"
                    >
                      <Crosshair className="w-4 h-4" />
                    </button>
                  )}
                  {from && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFrom(null);
                        setFromSearch("");
                        setDirectionStep("from");
                      }}
                      className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Suggestions for FROM */}
                <AnimatePresence>
                  {directionStep === "from" && suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden bg-slate-50 rounded-xl"
                    >
                      {suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSuggestion(suggestion, "from");
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-slate-100 transition-colors border-b border-white last:border-0 flex items-center gap-3"
                        >
                          <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="text-[10px] font-bold text-slate-600 truncate">
                            {suggestion.display_name}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {from && (
                  <motion.input
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    type="text"
                    placeholder="Précision porte, étage, couleur..."
                    value={fromPrecision}
                    onChange={(e) => setFromPrecision(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full mt-1 bg-slate-50 border-none rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500/20 outline-none placeholder:text-slate-400 placeholder:font-medium"
                  />
                )}
              </div>
              <div
                onClick={() => setDirectionStep("to")}
                className={cn(
                  "flex flex-col gap-1.5 p-2.5 rounded-2xl border-2 transition-all cursor-pointer bg-white relative z-10",
                  directionStep === "to"
                    ? "border-indigo-500"
                    : "border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-[6px] bg-red-500 flex items-center justify-center shrink-0 border-2 border-white">
                    <div className="w-1 h-1 bg-white rounded-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                      Destination
                    </p>
                    <input
                      type="text"
                      value={toSearch}
                      onChange={(e) => {
                        setToSearch(e.target.value);
                        fetchSuggestions(e.target.value);
                      }}
                      onFocus={() => {
                        setDirectionStep("to");
                        fetchSuggestions(toSearch);
                      }}
                      placeholder="Saisir ou cliquer sur la carte..."
                      className="w-full bg-transparent border-none font-bold text-sm outline-none p-0 h-5 placeholder:text-slate-300"
                    />
                  </div>
                  {to && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTo(null);
                        setToSearch("");
                        setDirectionStep("to");
                      }}
                      className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Suggestions for TO */}
                <AnimatePresence>
                  {directionStep === "to" && suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden bg-slate-50 rounded-xl"
                    >
                      {suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSuggestion(suggestion, "to");
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-slate-100 transition-colors border-b border-white last:border-0 flex items-center gap-3"
                        >
                          <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="text-[10px] font-bold text-slate-600 truncate">
                            {suggestion.display_name}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {to && (
                  <motion.input
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    type="text"
                    placeholder="Précision bâtiment, portail..."
                    value={toPrecision}
                    onChange={(e) => setToPrecision(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full mt-1 bg-slate-50 border-none rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500/20 outline-none placeholder:text-slate-400 placeholder:font-medium"
                  />
                )}
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!from || !to}
              className="w-full mt-4 py-3 bg-orange-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-orange-700 text-sm"
            >
              Suivant <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 2: Détails du colis */}
      <AnimatePresence>
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="absolute inset-0 z-40 bg-slate-50 pt-24 px-6 overflow-y-auto pb-[calc(8rem+env(safe-area-inset-bottom))] xl:pb-12"
          >
            <h2 className="text-2xl font-black text-slate-900 mb-6">
              Détails de la course
            </h2>

            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
              Véhicule requis
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { id: "moto", label: "Moto", d: "< 15kg", img: "🏍️" },
                {
                  id: "tricycle",
                  label: "Tricycle",
                  d: "Charge lourde",
                  img: "🛺",
                },
                {
                  id: "camionnette",
                  label: "Camion",
                  d: "Gros volumes",
                  img: "🚛",
                },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVehicleType(v.id as any)}
                  className={cn(
                    "p-3 rounded-2xl border-2 text-center transition-all",
                    vehicleType === v.id
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <div className="text-2xl mb-2">{v.img}</div>
                  <p className="font-black text-[11px] uppercase">{v.label}</p>
                  <p className="text-[9px] text-slate-400 mt-1">{v.d}</p>
                </button>
              ))}
            </div>

            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
              Taille
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { id: "small", label: "Léger", d: "Doc, clés" },
                { id: "medium", label: "Standard", d: "Repas, habits" },
                { id: "large", label: "Lourd", d: "Plus de 5kg" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSize(s.id as any)}
                  className={cn(
                    "p-3 rounded-2xl border-2 text-center transition-all",
                    size === s.id
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <Package
                    className={cn(
                      "w-6 h-6 mx-auto mb-2",
                      size === s.id ? "text-indigo-600" : "text-slate-400"
                    )}
                  />
                  <p className="font-black text-[11px] uppercase">{s.label}</p>
                  <p className="text-[9px] text-slate-400 mt-1">{s.d}</p>
                </button>
              ))}
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block pl-1">
                  Poids approx.
                </label>
                <select
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-orange-500 outline-none appearance-none"
                >
                  <option value="">Sélectionner...</option>
                  <option value="5">- 5 kg</option>
                  <option value="15">5kg - 20kg</option>
                  <option value="50">20kg - 100kg</option>
                  <option value="500">100kg - 1 Tonne</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block pl-1">
                  Mon téléphone (Expéditeur)
                </label>
                <input
                  type="tel"
                  placeholder="Ex: 70 00 00 00"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block pl-1">
                  Tél. Destinataire
                </label>
                <input
                  type="tel"
                  placeholder="Ex: 70 00 00 00"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 block pl-1">
                  Nature du colis
                </label>
                <select
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-orange-500 outline-none appearance-none"
                >
                  <option value="">Sélectionner...</option>
                  <option value="Colis Standard">Standard</option>
                  <option value="Fragile">Fragile</option>
                  <option value="Alimentaire">Alimentaire</option>
                  <option value="Plis">Documents</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={!recipientPhone || !senderPhone}
              className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-orange-700 mb-6"
            >
              Suivant <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 3: Recap & Pricing */}
      <AnimatePresence>
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="absolute inset-0 z-40 bg-slate-50 pt-24 px-6 overflow-y-auto pb-[calc(8rem+env(safe-area-inset-bottom))] xl:pb-12"
          >
            <h2 className="text-2xl font-black text-slate-900 mb-6">
              Récapitulatif & Prix
            </h2>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-6 space-y-4">
              <div className="flex gap-3">
                <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Départ
                  </p>
                  <p className="font-bold text-xs">{from?.address}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-1 w-2 h-2 rounded-[2px] bg-red-500 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Destination
                  </p>
                  <p className="font-bold text-xs">{to?.address}</p>
                </div>
              </div>
            </div>

            {driversAvailable === 0 && (
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6 flex items-start gap-4">
                <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-orange-800">
                    {driversBusy > 0
                      ? "Livreurs actuellement occupés"
                      : "Aucun livreur en ligne"}
                  </p>
                  <p className="text-xs text-orange-600 font-medium">
                    {driversBusy > 0
                      ? "Les livreurs proches sont tous occupés. Proposer un prix plus élevé ou activer le mode **Urgent** peut vous aider à trouver quelqu'un plus vite."
                      : "Aucun livreur n'est actuellement connecté dans votre zone. Vous pouvez quand même publier votre course."}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">
                  Mode Urgent (+500 F)
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Votre course sera traitée en priorité par les livreurs.
                </p>
              </div>
              <button
                onClick={() => setIsUrgent(!isUrgent)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  isUrgent ? "bg-orange-600" : "bg-slate-200"
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                    isUrgent ? "left-7" : "left-1"
                  )}
                />
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
              <div className="bg-indigo-50 px-5 py-4 border-b border-indigo-100">
                <p className="text-[10px] font-black uppercase text-indigo-800 tracking-widest mb-1">
                  Prix Estimé
                </p>
                <p className="text-3xl font-black text-indigo-900">
                  {estimatedCost} F
                </p>
              </div>
              <div className="p-5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                  Proposer un autre prix ?
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      setProposedPrice((p) =>
                        Math.max(0, (Number(p) || 0) - 100)
                      )
                    }
                    className="w-12 h-12 bg-slate-100 rounded-xl font-black text-slate-600"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={proposedPrice}
                    onChange={(e) => setProposedPrice(Number(e.target.value))}
                    className="flex-1 bg-white border-2 border-indigo-100 rounded-xl text-center font-black text-xl text-indigo-900 outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() =>
                      setProposedPrice((p) => (Number(p) || 0) + 100)
                    }
                    className="w-12 h-12 bg-slate-100 rounded-xl font-black text-slate-600"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6 p-5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                Code Promo
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Entrez un code promo"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-indigo-500 outline-none uppercase"
                />
                <button
                  onClick={handleApplyPromo}
                  className="px-4 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors"
                >
                  Appliquer
                </button>
              </div>
              {discount > 0 && (
                <p className="text-emerald-500 text-xs font-bold mt-2">
                  Remise appliquée : -{discount} F
                </p>
              )}
            </div>

            <button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 disabled:opacity-50 mb-6"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Publier la course"
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
