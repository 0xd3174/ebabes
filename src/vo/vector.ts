/**
 * Defines a two-dimensional vector.
 */
export class Vector {
	x: number;
	y: number;

	/**
	 * A sufficiently small positive number.
	 */
	static readonly RVO_EPSILON: number = 0.00001;

	/**
	 * Constructs and initializes a two-dimensional vector from the
	 * specified xy-coordinates.
	 *
	 * @param x The x-coordinate of the two-dimensional vector.
	 * @param y The y-coordinate of the two-dimensional vector.
	 */
	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	/**
	 * Returns the string representation of this vector.
	 *
	 * @returns The string representation of this vector.
	 */
	toString(): string {
		return '(' + this.x.toString() + ',' + this.y.toString() + ')';
	}

	/**
	 * Computes the dot product of the two specified
	 * two-dimensional vectors.
	 *
	 * @returns The dot product of the two specified two-dimensional
	 * vectors.
	 *
	 * @param v The other two-dimensional vector.
	 */
	dot(v: Vector): number {
		return this.x * v.x + this.y * v.y;
	}

	/**
	 * Computes the scalar multiplication of the specified
	 * two-dimensional vector with the specified scalar value.
	 *
	 * @returns The scalar multiplication of the specified two-dimensional
	 * vector with the specified scalar value.
	 *
	 * @param scalar The scalar value.
	 */
	mul(scalar: number): Vector {
		return new Vector(this.x * scalar, this.y * scalar);
	}

	/**
	 * Computes the scalar division of the specified
	 * two-dimensional vector with the specified scalar value.
	 *
	 * @returns The scalar division of the specified two-dimensional vector
	 * with the specified scalar value.
	 *
	 * @param scalar The scalar value.
	 */
	div(scalar: number): Vector {
		return new Vector(this.x / scalar, this.y / scalar);
	}

	/**
	 * Computes the vector sum of the two specified two-dimensional
	 * vectors.
	 *
	 * @returns The vector sum of the two specified two-dimensional vectors.
	 *
	 * @param vector The other two-dimensional vector.
	 */
	add(vector: Vector): Vector {
		return new Vector(this.x + vector.x, this.y + vector.y);
	}

	/**
	 * Computes the vector difference of the two specified
	 * two-dimensional vectors
	 *
	 * @returns The vector difference of the two specified two-dimensional
	 * vectors.
	 *
	 * @param vector The other two-dimensional vector.
	 */
	sub(vector: Vector): Vector {
		return new Vector(this.x - vector.x, this.y - vector.y);
	}

	/**
	 * Computes the negation of the specified two-dimensional
	 * vector.
	 *
	 * @returns The negation of the specified two-dimensional vector.
	 */
	neg(): Vector {
		return new Vector(-this.x, -this.y);
	}

	/**
	 * Computes the length of this two-dimensional vector.
	 *
	 * @returns The length of the two-dimensional vector.
	 */
	abs(): number {
		return Math.sqrt(this.absSq());
	}

	/**
	 * Computes the squared length of this two-dimensional
	 * vector.
	 *
	 * @returns The squared length of the two-dimensional vector.
	 */
	absSq(): number {
		return this.dot(this);
	}

	/**
	 * Computes the normalization of this two-dimensional
	 * vector.
	 *
	 * @returns The normalization of the two-dimensional vector.
	 */
	normalize(): Vector {
		return this.div(this.abs());
	}

	/**
	 * Computes the determinant of a two-dimensional square matrix
	 * with rows consisting of this vector and the specified vector.
	 *
	 * @returns The determinant of the two-dimensional square matrix.
	 *
	 * @param vector The bottom row of the two-dimensional square
	 * matrix.
	 */
	det(vector: Vector): number {
		return this.x * vector.y - this.y * vector.x;
	}

	/**
	 * Computes the squared distance from a line segment with the
	 * specified endpoints to a specified point.
	 *
	 * @returns The squared distance from the line segment to the point.
	 *
	 * @param vector1 The first endpoint of the line segment.
	 * @param vector2 The second endpoint of the line segment.
	 * @param vector3 The point to which the squared distance is to
	 * be calculated.
	 */
	static distSqPointLineSegment(
		vector1: Vector,
		vector2: Vector,
		vector3: Vector,
	): number {
		let r =
			vector3.sub(vector1).dot(vector2.sub(vector1)) /
			vector2.sub(vector1).absSq();

		if (r < 0.0) {
			return vector3.sub(vector1).absSq();
		}

		if (r > 1.0) {
			return vector3.sub(vector2).absSq();
		}

		return vector3.sub(vector1.add(vector2.sub(vector1).mul(r))).absSq();
	}

	/**
	 * Computes the signed distance from a line connecting the
	 * specified points to a specified point.
	 *
	 * @returns Positive when the point c lies to the left of the line ab.
	 *
	 * @param a The first point on the line.
	 * @param b The second point on the line.
	 * @param c The point to which the signed distance is to be
	 * calculated.
	 */
	static leftOf(a: Vector, b: Vector, c: Vector): number {
		return a.sub(c).det(b.sub(a));
	}
}
