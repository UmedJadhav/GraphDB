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

graphDB.Q = {}                                                     // prototype

graphDB.query = function(graph) {                                  // factory (only called by a graph's query initializers)
  var query = Object.create( graphDB.Q )

  query.graph = graph                                          // the graph itself
  query.state = []                                             // state for each step
  query.program = []                                             // list of steps to take
  query.gremlins = []                                             // gremlins for each step

  return query
}

graphDB.Q.run = function() {                                       // our virtual machine for query processing
    this.program = graphDB.transform(this.program)                   // activate the transformers
  
    var max = this.program.length - 1                               // last step in the program
    var maybe_gremlin = false                                       // a gremlin, a signal string, or false
    var results = []                                                // results for this particular run
    var done = -1                                                   // behindwhich things have finished
    var pc = max                                                    // our program counter -- we start from the end
  
    var step, state, pipetype
  
    // driver loop
    while(done < max) {
  
      step = this.program[pc]                                       // step is an array: first the pipe type, then its args
      state = (this.state[pc] = this.state[pc] || {})               // the state for this step: ensure it's always an object
      pipetype = graphDB.getPipetype(step[0])                        // a pipetype is just a function
  
      maybe_gremlin = pipetype(this.graph, step[1], maybe_gremlin, state)
  
      if(maybe_gremlin == 'pull') {                                 // 'pull' tells us the pipe wants further input
        maybe_gremlin = false
        if(pc-1 > done) {
          pc--                                                      // try the previous pipe
          continue
        } else {
          done = pc                                                 // previous pipe is finished, so we are too
        }
      }
  
      if(maybe_gremlin == 'done') {                                 // 'done' tells us the pipe is finished
        maybe_gremlin = false
        done = pc
      }
  
      pc++                                                          // move on to the next pipe
  
      if(pc > max) {
        if(maybe_gremlin)
          results.push(maybe_gremlin)                               // a gremlin popped out the end of the pipeline
        maybe_gremlin = false
        pc--                                                        // take a step back
      }
    }
  
    results = results.map(function(gremlin) {                       // return either results (like property('name')) or vertices
      return gremlin.result != null
           ? gremlin.result : gremlin.vertex } )
  
    return results
  }

graphDB.Q.add = function(pipetype, args) {                         // add a new step to the query
    var step = [pipetype, args]
    this.program.push(step)                                         // step is an array: first the pipe type, then its args
    return this
}

graphDB.Pipetypes = {}                                             // every pipe has a type

graphDB.addPipetype = function(name, fun) {                        // adds a new method to our query object
graphDB.Pipetypes[name] = fun
graphDB.Q[name] = function() {
    return this.add(name, [].slice.apply(arguments)) }            // capture the pipetype and args
}

graphDB.getPipetype = function(name) {
    var pipetype = graphDB.Pipetypes[name]                           // a pipe type is just a function

    if(!pipetype)
        graphDB.error('Unrecognized pipe type: ' + name)

    return pipetype || graphDB.fauxPipetype
}

graphDB.fauxPipetype = function(graph, args, maybe_gremlin) {      // if you can't find a pipe type
    return maybe_gremlin || 'pull'                                  // just keep things flowing along
}

// BUILT-IN PIPE TYPES

graphDB.addPipetype('vertex', function(graph, args, gremlin, state) {
    if(!state.vertices)
      state.vertices = graph.findVertices(args)                     // state initialization
  
    if(!state.vertices.length)                                      // all done
      return 'done'
  
    var vertex = state.vertices.pop()                               // OPT: this relies on cloning the vertices
    return graphDB.makeGremlin(vertex, gremlin.state)                // we can have incoming gremlins from as/back queries
  })

graphDB.addPipetype('in',   graphDB.simpleTraversal('in'))
graphDB.addPipetype('out',  graphDB.simpleTraversal('out'))
graphDB.addPipetype('both', graphDB.simpleTraversal('both'))

graphDB.addPipetype('property', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'                                      // query initialization
    gremlin.result = gremlin.vertex[args[0]]
    return gremlin.result == null ? false : gremlin                 // undefined or null properties kill the gremlin
})
  
graphDB.addPipetype('unique', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'                                      // query initialization
    if(state[gremlin.vertex._id]) return 'pull'                     // we've seen this gremlin, so get another instead
    state[gremlin.vertex._id] = true
    return gremlin
})
  
graphDB.addPipetype('filter', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'                                      // query initialization

    if(typeof args[0] == 'object')                                  // filter by object
        return graphDB.objectFilter(gremlin.vertex, args[0])
            ? gremlin : 'pull'

    if(typeof args[0] != 'function') {
        graphDB.error('Filter arg is not a function: ' + args[0])
        return gremlin                                                // keep things moving
    }

    if(!args[0](gremlin.vertex, gremlin)) return 'pull'             // gremlin fails filter function
    return gremlin
})
  
graphDB.addPipetype('take', function(graph, args, gremlin, state) {
    state.taken = state.taken || 0                                  // state initialization

    if(state.taken == args[0]) {
        state.taken = 0
        return 'done'                                                 // all done
    }

    if(!gremlin) return 'pull'                                      // query initialization
    state.taken++                                                   // THINK: if this didn't mutate state, we could be more
    return gremlin                                                  // cavalier about state management (but run the GC hotter)
})


graphDB.addPipetype('as', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'                                      // query initialization
    gremlin.state.as = gremlin.state.as || {}                       // initialize gremlin's 'as' state
    gremlin.state.as[args[0]] = gremlin.vertex                      // set label to the current vertex
    return gremlin
  })
  
graphDB.addPipetype('back', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'                                      // query initialization
    return graphDB.gotoVertex(gremlin, gremlin.state.as[args[0]])    // TODO: check for nulls
})
  
graphDB.addPipetype('except', function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'                                      // query initialization
    if(gremlin.vertex == gremlin.state.as[args[0]]) return 'pull'   // TODO: check for nulls
    return gremlin
})
  
graphDB.addPipetype('merge', function(graph, args, gremlin, state) {
    //// THINK: merge and back are very similar...
    if(!state.vertices && !gremlin) return 'pull'                   // query initialization

    if(!state.vertices || !state.vertices.length) {                 // state initialization
        var obj = (gremlin.state||{}).as || {}
        state.vertices = args.map(function(id) {return obj[id]}).filter(Boolean)
    }

    if(!state.vertices.length) return 'pull'                        // done with this batch

    var vertex = state.vertices.pop()
    return graphDB.makeGremlin(vertex, gremlin.state)
})

graphDB.simpleTraversal = function(dir) {                          // handles basic in, out and both pipetypes

    function get_edges(graph, dir, vertex, filter) {                // get edges that match our query
      var find_method = dir === 'out' ? 'findOutEdges' : 'findInEdges'
      var other_side  = dir === 'out' ? '_in' : '_out'
  
      return graph[find_method](vertex)
        .filter(graphDB.filterEdges(filter))
        .map(function(edge) { return edge[other_side] })
    }
  
    return function(graph, args, gremlin, state) {
      if(!gremlin && (!state.edges || !state.edges.length))         // query initialization
        return 'pull'
  
      if(!state.edges || !state.edges.length) {                     // state initialization
        state.gremlin = gremlin
        state.edges = get_edges(graph, dir, gremlin.vertex, args[0])
  
        if(dir === 'both')
          state.edges = state.edges.concat(
            get_edges(graph, 'out', gremlin.vertex, args[0]))
      }
  
      if(!state.edges.length)                                       // all done
        return 'pull'
  
      var vertex = state.edges.pop()                                // use up an edge
      return graphDB.gotoVertex(state.gremlin, vertex)
    }
  }


graphDB.makeGremlin = function(vertex, state) {                    // gremlins are simple creatures:
    return {vertex: vertex, state: state || {} }                    // a current vertex, and some state
  }
  
graphDB.gotoVertex = function(gremlin, vertex) {                   // clone the gremlin
    return graphDB.makeGremlin(vertex, gremlin.state)                // THINK: add path tracking here?
}
  
graphDB.filterEdges = function(filter) {
    return function(edge) {
        if(!filter)                                                   // if there's no filter, everything is valid
        return true

        if(typeof filter == 'string')                                 // if the filter is a string, the label must match
        return edge._label == filter

        if(Array.isArray(filter))                                     // if the filter is an array, the label must be in it
        return !!~filter.indexOf(edge._label)

        return graphDB.objectFilter(edge, filter)                      // try the filter as an object
    }
}

graphDB.objectFilter = function(thing, filter) {                   // thing has to match all of filter's properties
    for(var key in filter)
      if(thing[key] !== filter[key])
        return false
  
    return true
  }
  
graphDB.cleanVertex = function(key, value) {                       // for JSON.stringify
    return (key == '_in' || key == '_out') ? undefined : value
}

graphDB.cleanEdge = function(key, value) {
    return (key == '_in' || key == '_out') ? value._id : value
}

graphDB.jsonify = function(graph) {                                // kids, don't hand code JSON
    return '{"V":' + JSON.stringify(graph.vertices, graphDB.cleanVertex)
        + ',"E":' + JSON.stringify(graph.edges,    graphDB.cleanEdge)
        + '}'
}

graphDB.parseJSON = function(str) {
    try {
      return JSON.parse(str)
    } catch(err) {
      graphDB.error('Invalid JSON', err)
      return null
    }
  }
  
graphDB.cloneflat = function(graph) {
    return graphDB.parseJSON(graphDB.jsonify(graph))
}
  
graphDB.clone = function(graph) {
    var G = graphDB.cloneflat(graph)
    return graphDB.graph(G.V, G.E)
}
  
graphDB.persist = function(graph, name) {
    name = name || 'graph'
    localStorage.setItem('graphDB::'+name, graph)
}
  
graphDB.depersist = function (name) {
    name = 'graphDB::' + (name || 'graph')
    var flatgraph = localStorage.getItem(name)
    return graphDB.fromString(flatgraph)
}

graphDB.error = function(msg) {
    console.log(msg)
    return false
}
  
