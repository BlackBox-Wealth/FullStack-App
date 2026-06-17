import { useState } from "react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MapRoute,
  MarkerLabel,
  MapControls,
  MarkerTooltip
} from "@/components/ui/map";
import { Navigation, MapPin, Clock, Route as RouteIcon, Info, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

// WealthVault Bank Headquarters (Delhi(NCR))
const BANK_LOCATION = {
  name: "WealthVault Bank HQ",
  lng: 77.38,
  lat: 28.62,
  address: "Delhi NCR, India"
};

interface RouteData {
  coordinates: [number, number][];
  duration: number; // seconds
  distance: number; // meters
}

export default function BankLocator() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapTheme, setMapTheme] = useState<'light' | 'dark'>('light');

  const fetchRoute = async (startLng: number, startLat: number) => {
    setIsLoading(true);
    setRoute(null); // clear any stale route
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${BANK_LOCATION.lng},${BANK_LOCATION.lat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      if (data.routes?.length > 0) {
        const routeData = data.routes[0];

        setRoute({
          coordinates: routeData.geometry.coordinates,
          duration: routeData.duration,
          distance: routeData.distance,
        });
      } else {
        setError("No route found to the bank. Please try again.");
      }
    } catch (err) {
      console.error("Failed to fetch route:", err);
      setError("Could not calculate directions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocate = () => {
    setIsLocating(true);
    setError(null);
    setRoute(null);
    setUserLocation(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setIsLocating(false);
      return;
    }

    let watchId: number;
    let settled = false;

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude, accuracy } = position.coords;

        // Wait until accuracy is within 500m (filters out IP-based guesses ~5000m+)
        if (accuracy > 500 && !settled) return;

        settled = true;
        navigator.geolocation.clearWatch(watchId);

        setUserLocation([longitude, latitude]);
        fetchRoute(longitude, latitude);
        setIsLocating(false);
      },
      (err) => {
        navigator.geolocation.clearWatch(watchId);
        console.error("Geolocation error:", err);
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location permission denied. Please allow access in your browser settings.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Location unavailable. Please check your GPS/network.");
        } else {
          setError("Location request timed out. Please try again.");
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Fallback: if no accurate fix in 12s, use whatever we have
    setTimeout(() => {
      if (!settled) {
        settled = true;
        navigator.geolocation.clearWatch(watchId);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            setUserLocation([longitude, latitude]);
            fetchRoute(longitude, latitude);
            setIsLocating(false);
          },
          () => {
            setError("Could not get your location. Please try again.");
            setIsLocating(false);
          },
          { enableHighAccuracy: false, maximumAge: 0 }
        );
      }
    }, 12000);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <div className="card overflow-hidden flex flex-col h-[600px] border border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="section-heading__eyebrow">Find Us</div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MapPin className="text-amber-500" size={20} /> Bank Locator
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{BANK_LOCATION.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setMapTheme(prev => prev === 'light' ? 'dark' : 'light')}
              variant="outline"
              size="icon"
              className="rounded-xl border-border/50 hover:bg-muted"
              title={`Switch to ${mapTheme === 'light' ? 'dark' : 'light'} mode`}
            >
              {mapTheme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </Button>
            <Button
              onClick={handleLocate}
              disabled={isLocating || isLoading}
              variant="outline"
              className="gap-2 border-amber-500/30 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
            >
              <Navigation size={16} />
              {userLocation ? "Refresh Location" : "Find Route From Me"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-sm flex items-center gap-2 border border-red-100 dark:border-red-900/30">
            <Info size={14} /> {error}
          </div>
        )}
      </div>

      <div className="flex-1 relative bg-muted/20">
        <Map
          center={userLocation || [BANK_LOCATION.lng, BANK_LOCATION.lat]}
          zoom={userLocation ? 12 : 14}
          theme={mapTheme}
        >
          <MapControls showZoom showLocate showFullscreen />

          {/* Bank Marker */}
          <MapMarker longitude={BANK_LOCATION.lng} latitude={BANK_LOCATION.lat}>
            <MarkerContent>
              <div className="size-8 rounded-xl bg-amber-500 border-2 border-white flex items-center justify-center shadow-lg transform -rotate-45 hover:scale-110 transition-transform">
                <MapPin size={18} className="text-white rotate-45" />
              </div>
              <MarkerLabel position="bottom" className="font-bold">{BANK_LOCATION.name}</MarkerLabel>
            </MarkerContent>
            <MarkerTooltip>
              <div className="p-2">
                <p className="font-bold">{BANK_LOCATION.name}</p>
                <p className="text-[10px] opacity-80 whitespace-nowrap">{BANK_LOCATION.address}</p>
              </div>
            </MarkerTooltip>
          </MapMarker>

          {/* User Marker — only render after valid location + route confirmed */}
          {userLocation && route && (
            <MapMarker longitude={userLocation[0]} latitude={userLocation[1]}>
              <MarkerContent>
                <div className="size-6 rounded-full bg-blue-500 border-2 border-white shadow-xl flex items-center justify-center">
                  <div className="size-2 bg-white rounded-full animate-ping" />
                </div>
                <MarkerLabel position="top">You are here</MarkerLabel>
              </MarkerContent>
            </MapMarker>
          )}

          {/* Route */}
          {route && (
            <MapRoute
              coordinates={route.coordinates}
              color="#f59e0b"
              width={6}
              opacity={0.8}
            />
          )}
        </Map>

        {/* Route Stats Overlay — Sleek Floating Pill (Larger) */}
        {route && !isLoading && (
          <div className="absolute top-6 left-6 z-20 pointer-events-none group">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border/40 pl-6 pr-4 py-3 rounded-full shadow-2xl flex items-center gap-6 border-l-[6px] border-l-amber-500">

              {/* TIME SECTION */}
              <div className="flex items-center gap-3">
                <div className="bg-amber-500/10 p-2 rounded-full">
                  <Clock size={18} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-base font-bold tracking-tight text-foreground">
                    {formatDuration(route.duration)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Time</span>
                </div>
              </div>

              {/* DIVIDER */}
              <div className="h-8 w-px bg-border/60" />

              {/* DISTANCE SECTION */}
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded-full">
                  <RouteIcon size={18} className="text-muted-foreground" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-base font-bold tracking-tight text-foreground">
                    {formatDistance(route.distance)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Distance</span>
                </div>
              </div>

              {/* LIVE INDICATOR PILL */}
              <div className="ml-2 flex items-center gap-2 bg-emerald-500/10 px-3 py-2 rounded-full border border-emerald-500/20">
                <div className="size-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Live</span>
              </div>

            </div>
          </div>
        )}

        {(isLoading || isLocating) && (
          <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px] flex items-center justify-center z-10">
            <div className="bg-background border border-border p-4 rounded-2xl shadow-xl flex items-center gap-3">
              <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-bold">
                {isLocating ? "Getting your location..." : "Calculating Route..."}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-muted/10 border-t border-border/50 text-[10px] text-center text-muted-foreground italic">
        Route data powered by OpenStreetMap contributors via OSRM. Actual travel times may vary.
      </div>
    </div>
  );
}