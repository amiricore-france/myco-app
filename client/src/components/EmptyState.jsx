export default function EmptyState({ icon = '🍄', title, description, action }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center sm:p-12">
      <div className="mb-3 text-5xl sm:text-6xl">{icon}</div>
      <h3 className="mb-1 text-lg font-semibold text-neutral-900">{title}</h3>
      {description && (
        <p className="mx-auto mb-5 max-w-md text-sm text-neutral-500">{description}</p>
      )}
      {action}
    </div>
  );
}
