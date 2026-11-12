import Brand from "./Brand";

export default function PageLoader() {
    return (
        <div className="page-loader" role="status" aria-live="polite">
            <Brand />
            <span className="loader-track" aria-hidden="true">
                <span />
            </span>
            <p>Loading your workspace…</p>
        </div>
    );
}