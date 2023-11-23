module.exports = {
    create(context) {
        const code = context.getSourceCode()
        return {
            CallExpression(node) {
                const { trailing } = code.getComments(node)
                const remove = trailing.filter(({ value }) => /^\stodo:\sremove\slog$/.test(value))
                remove.length && context.report(node, 'Logs marked for removal should be removed')
            },
        }
    },
}
