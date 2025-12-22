import React, { useEffect, useMemo, useState } from "react";
import tokenManager from "../services/tokenManager";
import { useAuth } from "../context/AuthContext";

function AuthedImg({
    src,
    alt,
    className,
    imgKey,
    onFail,
    ...props
}) {
    const { user, loading } = useAuth();
    const [blobUrl, setBlobUrl] = useState(null);

    const isDirect = useMemo(() => {
        if (!src) return true;
        return src.startsWith("data:") || src.startsWith("blob:");
    }, [src]);

    useEffect(() => {
        let cancelled = false;
        let createdUrl = null;

        if (loading) return; // Wait for auth to settle

        async function run() {
            // Reset only if we are taking a new src that isn't direct
            setBlobUrl(null);

            if (!src) return;

            // data: and blob: can be used as-is
            if (isDirect) {
                setBlobUrl(src);
                return;
            }

            try {
                const token = tokenManager.getToken();
                const res = await fetch(src, {
                    method: "GET",
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    // We use no-store to avoid caching auth errors, but strictly speaking 
                    // we might want caching. Following user instruction:
                    cache: "no-store",
                });

                if (!res.ok) {
                    throw new Error(`Photo fetch failed: ${res.status} ${res.statusText}`);
                }

                const blob = await res.blob();
                createdUrl = URL.createObjectURL(blob);

                if (!cancelled) setBlobUrl(createdUrl);
            } catch (e) {
                if (!cancelled) {
                    console.error("[AuthedImg] Failed loading image:", e);
                    onFail?.(e);
                }
            }
        }

        run();

        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [src, isDirect, user, loading]);

    if (!src) return null;

    return (
        <img
            key={imgKey}
            src={blobUrl || undefined}
            alt={alt}
            className={className}
            onError={(e) => {
                // If blob URL fails (rare), still surface it
                onFail?.(new Error("Image element failed after blob/url"));
            }}
            {...props}
        />
    );
}

export default AuthedImg;
