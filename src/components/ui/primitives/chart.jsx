import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

const THEMES = { light: "", dark: ".dark" };

const ChartContext = React.createContext(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

function ChartContainer({ id, className, children, config, ...props }) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        data-slot="chart"
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 " +
            "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_.recharts-polar-grid-angle]:stroke-border " +
            "[&_.recharts-polar-radius-axis-axis_line]:stroke-border " +
            "[&_.recharts-pie-label-text]:fill-foreground [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted " +
            "[&_.recharts-reference-line-[stroke='#ccc']]:stroke-border flex aspect-video w-full justify-center " +
            "text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden " +
            "[&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent " +
            "[&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }) {
  const colorConfig = Object.entries(config).filter(([, config]) => config.theme || config.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme] || itemConfig.color;
    return itemConfig.theme || itemConfig.color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`
          )
          .join("\n"),
      }}
    />
  );
}

function ChartTooltipContent({ active, payload, className, label, labelClassName, formatter, ...props }) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  const nestLabel = payload.length === 1 && label !== undefined;
  const labelKey = nestLabel ? undefined : `payload[0].name`;

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border bg-card p-3 text-xs shadow-lg",
        className
      )}
      {...props}
    >
      {label !== undefined && (
        <div className={cn("text-muted-foreground grid grid-flow-col items-center gap-1.5 text-nowrap", labelClassName)}>
          {label}
        </div>
      )}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${labelKey ?? item.dataKey ?? item.name}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const displayName = label !== undefined
            ? (labelKey ? item.name : itemConfig?.label || "—")
            : itemConfig?.label !== undefined
              ? itemConfig.label
              : item.name;

          const formattedValue = formatter?.(item.value, item.name, item, index, itemConfig) ?? String(item.value);

          return (
            <div key={item.name} className="flex items-center gap-2">
              {itemConfig?.icon ? (
                <itemConfig.icon iconSize={12} strokeWidth="1.5" className="size-3.5 shrink-0" />
              ) : (
                <div
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-[2px]", {
                    // Color can only be a CSS variable if number comes from config; fallback to currentColor otherwise
                    "bg-transparent": false,
                  })}
                  style={{
                    backgroundColor: itemConfig?.color,
                  }}
                />
              )}
              <span className="text-muted-foreground flex items-center gap-1">
                <span className="truncate">{displayName}</span>
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                {formattedValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartTooltip(props) {
  return <RechartsPrimitive.Tooltip {...props} content={ChartTooltipContent} />;
}

function ChartLegend({ payload, className, content, ...props }) {
  return <RechartsPrimitive.Legend className={cn("pt-1.5", className)} payload={payload} content={content || ChartLegendContent} {...props} />;
}

function ChartLegendContent({ payload, className }) {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-4", className)}>
      {payload.map((item) => {
        const key = `${item.dataKey || item.value || item.name}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);
        return (
          <div key={item.name} className="flex items-center gap-1.5">
            {itemConfig?.icon ? (
              <itemConfig.icon iconSize={12} strokeWidth="1.5" className="size-3.5 shrink-0" />
            ) : (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: itemConfig?.color }}
              />
            )}
            <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function getPayloadConfigFromPayload(config, payload, key) {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }
  const payloadPayload = "payload" in payload && typeof payload.payload === "object" && payload.payload !== null
    ? payload.payload
    : undefined;
  const configLabelKey = key === "chart" ? "label" : key;
  const itemConfig = config?.[configLabelKey];
  if (itemConfig) {
    return {
      ...itemConfig,
      color:
        itemConfig.color ||
        (typeof payloadPayload?.[key] !== "undefined" && typeof payloadPayload[key] === "object"
          ? undefined
          : undefined),
    };
  }
  if (key === "chart" && config?.["label"]) {
    return config["label"];
  }
  if (payloadPayload && config?.[payloadPayload[key]]) {
    return {
      ...config[payloadPayload[key]],
      color: config[payloadPayload[key]].color,
    };
  }
  return undefined;
}

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
};