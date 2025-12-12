<script setup lang="ts">
import { computed } from 'vue'
import { useChildStatisticsStore, type DailySessionCount } from '@/stores/child-statistics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig,
} from '@/components/ui/chart'
import { VisAxis, VisGroupedBar, VisXYContainer } from '@unovis/vue'
import { BarChart3 } from 'lucide-vue-next'

const props = defineProps<{
  childId: string
}>()

const childStatisticsStore = useChildStatisticsStore()

// Get daily session counts for the last 30 days
const chartData = computed<DailySessionCount[]>(() => {
  return childStatisticsStore.getDailySessionCounts(props.childId, 30)
})

const chartConfig = {
  count: {
    label: 'Sessions',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig
</script>

<template>
  <Card class="flex h-full flex-col">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <div>
        <CardTitle class="text-base font-medium">Practice Sessions</CardTitle>
        <CardDescription>Daily sessions over the last 30 days</CardDescription>
      </div>
      <BarChart3 class="size-4 text-muted-foreground" />
    </CardHeader>
    <CardContent class="flex-1">
      <ChartContainer :config="chartConfig" class="h-full max-h-[280px] w-full" cursor>
        <VisXYContainer
          :data="chartData"
          :margin="{ left: 0, right: 0 }"
          :y-domain="[0, undefined]"
        >
          <VisGroupedBar
            :x="(d: DailySessionCount) => new Date(d.date)"
            :y="(d: DailySessionCount) => d.count"
            :color="chartConfig.count.color"
            :bar-padding="0.1"
            :rounded-corners="false"
          />
          <VisAxis
            type="x"
            :x="(d: DailySessionCount) => new Date(d.date)"
            :tick-line="false"
            :domain-line="false"
            :grid-line="false"
            :tick-format="
              (d: number) => {
                const date = new Date(d)
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            "
          />
          <VisAxis type="y" :num-ticks="3" :tick-line="false" :domain-line="false" />
          <ChartTooltip />
          <ChartCrosshair
            :template="
              componentToString(chartConfig, ChartTooltipContent, {
                labelFormatter(d: number | Date) {
                  return new Date(d).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                },
              })
            "
            color="rgba(255, 255, 255, 0.3)"
          />
        </VisXYContainer>
      </ChartContainer>
    </CardContent>
  </Card>
</template>
