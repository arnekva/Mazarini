import ImageCharts from 'image-charts'

export type chartType = 'pie' | 'bar'
export type chartData = { value: string; label: string }[]
export namespace ChartUtils {
    /** Creates a chart based on supplied chart type. (Only bar for now)
     *  @param data Is a value/label pair - label is the pretty name used for the chart label, so do not use keys directly - find a prettyprint name to use
     *  @param colors Will use idx 1 for bar 1m idx 2 for bar 2 etc.
     */
    export const createChart = (chartType: chartType, data: chartData, colors: string[]) => {
        const chart = new ImageCharts()
            .cht('bvg')
            .chd(`a:${data.map((d) => d.value).join(', ')}`)
            .chl(`${data.map((p) => p.label).join('|')}`)
            .chdl('Antall')
            .chxt('y')
            .chbr('10')
            .chlps('align,center|color,FFFFFF')
            .chco(colors.join('|'))
            .chs('650x400')
        return chart.toURL()
    }
}
