var graphDB = {}                                                   // the namespace

graphDB.G = {}                                                     // the prototype

graphDB.graph = function(V, E) {                                   // the factory
  var graph = Object.create( graphDB.G )
  graph.edges       = []                                          // fresh copies so they're not shared
  graph.vertices    = []
  graph.vertexIndex = {}
  graph.autoid = 1                                                // an auto-incrementing id counter
  if(Array.isArray(V)) graph.addVertices(V)                       // arrays only, because you wouldn't
  if(Array.isArray(E)) graph.addEdges(E)                          // call this with singular V and E
  return graph
}

graphDB.G.v = function() {                                         // a query initializer: g.v() -> query
    var query = graphDB.query(this)
    query.add('vertex', [].slice.call(arguments))                   // add vertex as first query pipe
    return query
  }
  
graphDB.G.addVertex = function(vertex) {                           // accepts a vertex-like object, with properties
    if(vertex._id >= this.autoid)
        this.autoid = vertex._id + 1                                  // ensure autoid doesn't overwrite
    if(!vertex._id)
        vertex._id = this.autoid++
    else if(this.findVertexById(vertex._id))
        return graphDB.error('A vertex with id ' + vertex._id + ' already exists')

    this.vertices.push(vertex)
    this.vertexIndex[vertex._id] = vertex
    vertex._out = []; vertex._in = []                               // placeholders for edge pointers
    return vertex._id
}

graphDB.G.addEdge = function(edge) {                               // accepts an edge-like object, with properties
    edge._in  = this.findVertexById(edge._in)
    edge._out = this.findVertexById(edge._out)

    if(!(edge._in && edge._out))
        return graphDB.error("That edge's " + (edge._in ? 'out' : 'in') + " vertex wasn't found")

    edge._out._out.push(edge)                                       // add edge to the edge's out vertex's out edges
    edge._in._in.push(edge)                                         // vice versa
    this.edges.push(edge)
    }

graphDB.G.addVertices = function(vertices) { vertices.forEach(this.addVertex.bind(this)) }
graphDB.G.addEdges    = function(edges)    { edges   .forEach(this.addEdge  .bind(this)) }

graphDB.G.removeVertex = function(vertex) {
    vertex._in .slice().forEach(graphDB.G.removeEdge.bind(this))
    vertex._out.slice().forEach(graphDB.G.removeEdge.bind(this))
    graphDB.remove(this.vertices, vertex)
    delete this.vertexIndex[vertex._id]
}

graphDB.G.removeEdge = function(edge) {
    graphDB.remove(edge._in._in, edge)
    graphDB.remove(edge._out._out, edge)
    graphDB.remove(this.edges, edge)
}

graphDB.G.findVertices = function(args) {                          // our general vertex finding function
    if(typeof args[0] == 'object')
        return this.searchVertices(args[0])
    else if(args.length == 0)
        return this.vertices.slice()                                  // OPT: slice is costly with lots of vertices
    else
        return this.findVerticesByIds(args)
}
  
graphDB.G.findVerticesByIds = function(ids) {
  return ids.length == 1
         ? [].concat( this.findVertexById(ids[0]) || [] )
         : ids.map( this.findVertexById.bind(this) ).filter(Boolean) }

graphDB.G.findVertexById = function(vertex_id) {
    return this.vertexIndex[vertex_id]
}

graphDB.G.searchVertices = function(filter) {                      // find vertices that match obj's key-value pairs
    return this.vertices.filter(function(vertex) {
        return graphDB.objectFilter(vertex, filter)
    })
}

graphDB.G.findOutEdges = function(vertex) { return vertex._out; }
graphDB.G.findInEdges  = function(vertex) { return vertex._in;  }

graphDB.G.toString = function() { return graphDB.jsonify(this) }    // serialization

graphDB.fromString = function(str) {                               // another graph constructor
  var obj = graphDB.parseJSON(str)                                 // this could throw
  if(!obj) return null
  return graphDB.graph(obj.V, obj.E)
}
